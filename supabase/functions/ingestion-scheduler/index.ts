// Copyright (c) 2026 Shams Guettaf (Anthropotech Lab). Tous droits réservés.
// Edge Function "ingestion-scheduler" — version durcie
//
// Parcourt les sources RSS natives ET les sources personnalisées
// RSS-compatibles des utilisateurs, ingère les nouveaux articles avec
// détection de langue, les fait correspondre aux sujets suivis via leurs
// mots-clés, avec isolation utilisateur pour les sources personnalisées.
//
// Changements par rapport à la version précédente :
//   1. Jeton d'ingestion dédié. La clé anon étant publique et lisible dans
//      le code source du dashboard, n'importe qui pouvait déclencher cette
//      fonction en boucle : consommation d'invocations, écritures en base,
//      et rafales de requêtes vers les sites tiers depuis les IP Supabase.
//      Un en-tête X-Ingest-Token est désormais exigé. La fonction refuse
//      tout si le secret INGEST_TOKEN n'est pas défini (fermeture par
//      défaut).
//   2. Garde-fou anti-SSRF sur les URL des user_sources, qui sont saisies
//      par les utilisateurs. Sans lui, il suffisait d'enregistrer une
//      source malveillante pour que le cron aille la chercher toutes les
//      vingt minutes.
//   3. Détection de langue corrigée (voir detectLanguage).
//   4. Filet global contre les exceptions non rattrapées.
//
// NON traité ici, volontairement — voir point 5 du plan de remise en état :
//   le couple ignoreDuplicates:true / if (!article) continue dans
//   processItems saute le rattachement aux sujets pour tout article déjà
//   présent en base. C'est un défaut fonctionnel, pas de sécurité ; il
//   modifie le comportement des données et mérite son propre déploiement
//   et sa propre vérification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_TOKEN = Deno.env.get("INGEST_TOKEN") ?? "";

// Nombre de sources personnalisées traitées par cycle. Toutes les traiter
// d'un coup dépassait le temps d'exécution autorisé dès quelques dizaines de
// sources. Les moins récemment synchronisées passent en premier : traiter une
// source la renvoie en fin de file, aucune ne peut donc être oubliée et aucun
// état supplémentaire n'est à conserver.
const USER_SOURCES_PER_RUN = 30;

const RSS_COMPATIBLE_TYPES = [
  "rss",
  "website",
  "blog",
  "newsletter",
  "youtube",
  "podcast",
];

// --- Comparaison de jeton ----------------------------------------------------
// Comparaison à durée constante : une comparaison naïve s'interrompt au
// premier caractère différent, ce qui laisse fuir la position de l'écart.

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// --- Détection de langue -----------------------------------------------------
//
// L'ancienne expression utilisait \y comme frontière de mot. \y existe en
// regex POSIX (celle de Postgres) mais PAS en JavaScript, où un échappement
// non reconnu est traité comme le caractère littéral. L'expression cherchait
// donc "yley", "ylay", etc. et ne correspondait jamais à rien : tous les
// articles étaient classés "en", y compris les articles français.
//
// Les inspections sur \p{L} couvrent les lettres accentuées, contrairement à
// \b fondé sur [A-Za-z0-9_], qui échouerait sur "à". Le seuil de deux
// correspondances limite les faux positifs sur les titres courts.
// Identique à la version déployée dans analyze-topic.

const FRENCH_STOPWORDS =
  /(?<!\p{L})(?:le|la|les|des|une|un|est|dans|pour|avec|sur|au|aux|qui|que|à|ce|cette|ses|leur)(?!\p{L})/giu;

function detectLanguage(text: string): string {
  const matches = text.match(FRENCH_STOPWORDS);
  return matches && matches.length >= 2 ? "fr" : "en";
}

// =============================================================================
// Garde-fou anti-SSRF — appliqué aux seules URL saisies par les utilisateurs.
// Les 8 sources natives sont administrées et ne passent pas par ce filtre :
// leur y soumettre ferait courir un risque de régression sans contrepartie.
//
// Limite connue et assumée : DNS rebinding. Entre la résolution effectuée ici
// et celle effectuée par fetch(), un serveur DNS hostile peut changer sa
// réponse. S'en prémunir exigerait d'ouvrir la connexion soi-même sur
// l'adresse validée, ce que l'API fetch de Deno ne permet pas.
// =============================================================================

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
const DNS_TIMEOUT_MS = 3_000;
const MAX_CONSECUTIVE_FAILURES = 10;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "instance-data.ec2.internal",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain"];

class GuardError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "GuardError";
  }
}

function parseIPv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}

function looksLikeIpLiteral(hostname: string): boolean {
  if (hostname.includes(":") || hostname.startsWith("[")) return true;
  if (parseIPv4(hostname)) return true;
  if (/^\d+$/.test(hostname)) return true;
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true;
  if (/^[0-9a-fx.]+$/i.test(hostname) && /^\d|^0x/i.test(hostname)) return true;
  return false;
}

function isNonPublicIPv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 0) return true;
  if (a >= 224) return true;
  return false;
}

async function assertHostAllowed(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();

  if (!host) throw new GuardError("HOTE_ABSENT");
  if (looksLikeIpLiteral(host)) throw new GuardError("ADRESSE_IP_LITTERALE");
  if (BLOCKED_HOSTNAMES.has(host)) throw new GuardError("HOTE_INTERDIT");
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new GuardError("HOTE_INTERDIT");
  }
  if (!host.includes(".")) throw new GuardError("HOTE_NON_QUALIFIE");

  const resolver = (Deno as { resolveDns?: unknown }).resolveDns;
  if (typeof resolver !== "function") return;

  let addresses: string[];
  try {
    addresses = await Promise.race([
      Deno.resolveDns(host, "A"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS_TIMEOUT")), DNS_TIMEOUT_MS)
      ),
    ]);
  } catch {
    return;
  }

  if (!addresses || addresses.length === 0) return;

  for (const address of addresses) {
    const octets = parseIPv4(address);
    if (!octets || isNonPublicIPv4(octets)) {
      throw new GuardError("ADRESSE_NON_PUBLIQUE");
    }
  }
}

async function validateUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new GuardError("URL_INVALIDE");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new GuardError("SCHEMA_INTERDIT");
  if (url.username || url.password) throw new GuardError("IDENTIFIANTS_DANS_URL");

  await assertHostAllowed(url.hostname);
  return url;
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new GuardError("REPONSE_TROP_VOLUMINEUSE");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function safeFetchText(rawUrl: string): Promise<string> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await validateUrl(current);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; SynapseBot/1.0; +https://anthropotech.lab)",
          Accept:
            "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.1",
        },
      });
    } catch {
      throw new GuardError("HOTE_INJOIGNABLE");
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      try {
        await response.body?.cancel();
      } catch {
        // corps deja consomme
      }
      if (!location) throw new GuardError("REDIRECTION_SANS_CIBLE");
      current = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) throw new GuardError(`STATUT_${response.status}`);

    return await readCapped(response);
  }

  throw new GuardError("TROP_DE_REDIRECTIONS");
}

// --- Analyse RSS -------------------------------------------------------------

function stripCdata(value: string): string {
  const match = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (match ? match[1] : value).trim();
}

function extractTag(block: string, tag: string): string {
  const match = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return match ? stripCdata(match[1]) : "";
}

type FeedItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: Date;
};

function parseRss(xml: string): FeedItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  return items.map((item) => {
    const title = extractTag(item, "title");
    let link = extractTag(item, "link");
    if (!link) {
      const hrefMatch = item.match(/<link[^>]*href="([^"]+)"/i);
      link = hrefMatch ? hrefMatch[1] : "";
    }

    const pubDateRaw =
      extractTag(item, "pubDate") ||
      extractTag(item, "published") ||
      extractTag(item, "dc:date");

    const description =
      (extractTag(item, "description") || extractTag(item, "summary"))
        .replace(/<[^>]+>/g, "")
        .slice(0, 500);

    const parsedDate = pubDateRaw ? new Date(pubDateRaw) : new Date();

    return {
      title,
      link,
      description,
      publishedAt: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    };
  });
}

// --- Traitement --------------------------------------------------------------

async function processItems(
  supabase: ReturnType<typeof createClient>,
  items: FeedItem[],
  articleInsertBase: Record<string, unknown>,
  topics: { id: string; keywords: { term: string }[] | null }[],
) {
  const usable = items.filter((item) => item.title && item.link);
  if (usable.length === 0) return { inserted: 0, matches: 0 };

  // Une même adresse peut apparaître deux fois dans un flux mal formé.
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const item of usable) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    rows.push({
      ...articleInsertBase,
      canonical_url: item.link,
      title: item.title,
      content_snippet: item.description,
      published_at: item.publishedAt.toISOString(),
      language: detectLanguage(`${item.title} ${item.description}`),
    });
  }

  // Un seul appel pour tout le flux au lieu d'un par article. Sur une
  // vingtaine d'articles, cela remplace une vingtaine d'allers-retours.
  //
  // NOTE : voir l'en-tête de fichier. ignoreDuplicates est conservé, donc
  // seuls les articles réellement insérés sont renvoyés et le matching saute
  // encore tout article déjà présent en base. Défaut fonctionnel connu,
  // traité au point 5 du plan, délibérément non modifié ici.
  const { data: inserted, error: upsertError } = await supabase
    .from("articles")
    .upsert(rows, { onConflict: "canonical_url", ignoreDuplicates: true })
    .select("id, title, content_snippet");

  if (upsertError) {
    console.error("ingestion-scheduler : écriture des articles", upsertError);
    return { inserted: 0, matches: 0 };
  }

  const insertedRows = inserted ?? [];
  const links: Record<string, unknown>[] = [];

  for (const article of insertedRows) {
    const haystack =
      `${article.title ?? ""} ${article.content_snippet ?? ""}`.toLowerCase();

    for (const topic of topics) {
      const topicKeywords = (topic.keywords as { term: string }[] | null) ?? [];
      const matched = topicKeywords
        .map((k) => k.term)
        .filter((term) => haystack.includes(term.toLowerCase()));

      if (matched.length > 0) {
        links.push({
          article_id: article.id,
          topic_id: topic.id,
          matched_keywords: matched,
        });
      }
    }
  }

  if (links.length > 0) {
    const { error: linkError } = await supabase
      .from("article_topics")
      .upsert(links, {
        onConflict: "article_id,topic_id",
        ignoreDuplicates: true,
      });

    if (linkError) {
      console.error("ingestion-scheduler : écriture des liens", linkError);
      return { inserted: insertedRows.length, matches: 0 };
    }
  }

  return { inserted: insertedRows.length, matches: links.length };
}

// --- Fonction ----------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    // --- Contrôle du jeton d'ingestion --------------------------------------
    // Fermeture par défaut : sans secret configuré, la fonction ne traite
    // rien. Mieux vaut une ingestion à l'arrêt qu'un point d'entrée ouvert.
    if (!INGEST_TOKEN) {
      console.error("ingestion-scheduler : INGEST_TOKEN non configuré, appel refusé");
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const provided = req.headers.get("X-Ingest-Token") ?? "";
    if (!safeCompare(provided, INGEST_TOKEN)) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let totalArticlesInserted = 0;
    let totalTopicMatches = 0;

    // --- Sources natives ----------------------------------------------------
    const { data: sources } = await supabase
      .from("sources")
      .select("id, url")
      .eq("active", true)
      .eq("type", "rss");

    // Un seul appel pour tous les sujets actifs, groupés ensuite par
    // utilisateur. Auparavant chaque source personnalisée déclenchait sa
    // propre requête de sujets, soit autant d'allers-retours que de sources.
    const { data: allActiveTopics } = await supabase
      .from("topics")
      .select("id, user_id, keywords(term)")
      .eq("status", "active");

    const topicsByUser = new Map<
      string,
      { id: string; keywords: { term: string }[] | null }[]
    >();
    for (const topic of allActiveTopics ?? []) {
      const key = topic.user_id as string;
      const list = topicsByUser.get(key) ?? [];
      list.push(topic);
      topicsByUser.set(key, list);
    }

    const sourceList = sources ?? [];

    // Récupération simultanée : le temps de collecte passe de la somme des
    // temps de réponse au plus lent d'entre eux. allSettled plutôt que all,
    // pour qu'un flux indisponible n'entraîne pas les autres.
    const nativeFetches = await Promise.allSettled(
      sourceList.map((source) =>
        fetch(source.url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then(
          (response) => response.text(),
        ),
      ),
    );

    for (let i = 0; i < sourceList.length; i++) {
      const source = sourceList[i];
      const result = nativeFetches[i];

      if (result.status === "rejected") {
        console.error(
          `Erreur d'ingestion pour ${source.url} :`,
          String(result.reason),
        );
        continue;
      }

      try {
        const items = parseRss(result.value);
        const { inserted, matches } = await processItems(
          supabase,
          items,
          { source_id: source.id },
          allActiveTopics ?? [],
        );
        totalArticlesInserted += inserted;
        totalTopicMatches += matches;
      } catch (err) {
        console.error(`Erreur de traitement pour ${source.url} :`, err);
      }
    }

    // --- Sources personnalisées (RSS-compatibles, dues pour sync) -----------
    const { data: userSources } = await supabase
      .from("user_sources")
      .select("id, user_id, url, type, sync_frequency_minutes, last_synced_at, consecutive_failures")
      .eq("active", true)
      .in("type", RSS_COMPATIBLE_TYPES);

    const now = Date.now();
    const allDue = (userSources ?? []).filter((s) => {
      if (!s.last_synced_at) return true;
      const elapsedMin =
        (now - new Date(s.last_synced_at).getTime()) / 60000;
      return elapsedMin >= s.sync_frequency_minutes;
    });

    // File d'attente : les moins récemment synchronisées d'abord, celles qui
    // ne l'ont jamais été en tête. Traiter une source la renvoie en queue,
    // donc la file tourne d'elle-même et aucune source n'est oubliée.
    const dueSources = allDue
      .sort((a, b) => {
        const ta = a.last_synced_at ? new Date(a.last_synced_at).getTime() : 0;
        const tb = b.last_synced_at ? new Date(b.last_synced_at).getTime() : 0;
        return ta - tb;
      })
      .slice(0, USER_SOURCES_PER_RUN);

    // Récupération simultanée du paquet, garde-fou anti-SSRF inclus : chaque
    // adresse passe toujours par safeFetchText.
    const userFetches = await Promise.allSettled(
      dueSources.map((source) => safeFetchText(source.url)),
    );

    for (let i = 0; i < dueSources.length; i++) {
      const source = dueSources[i];
      const result = userFetches[i];

      try {
        if (result.status === "rejected") throw result.reason;

        const items = parseRss(result.value);

        const { inserted, matches } = await processItems(
          supabase,
          items,
          { user_source_id: source.id },
          topicsByUser.get(source.user_id as string) ?? [],
        );

        totalArticlesInserted += inserted;
        totalTopicMatches += matches;

        await supabase
          .from("user_sources")
          .update({
            last_synced_at: new Date().toISOString(),
            last_test_status: "success",
            last_test_message: null,
            consecutive_failures: 0,
          })
          .eq("id", source.id);
      } catch (err) {
        const code = err instanceof GuardError ? err.code : "ERREUR";
        console.error(
          `Erreur d'ingestion pour source personnalisée ${source.id} : ${code}`,
        );

        // Message générique côté base : le détail réseau ne doit pas être
        // exposé à l'utilisateur, il transformerait la page Sources en outil
        // de reconnaissance.
        const message =
          err instanceof GuardError &&
          [
            "ADRESSE_IP_LITTERALE",
            "HOTE_INTERDIT",
            "HOTE_NON_QUALIFIE",
            "ADRESSE_NON_PUBLIQUE",
            "IDENTIFIANTS_DANS_URL",
            "SCHEMA_INTERDIT",
            "URL_INVALIDE",
          ].includes(err.code)
            ? "Cette adresse n'est pas autorisée."
            : "Impossible de récupérer ce flux.";

        // Compteur d'échecs consécutifs : une source qui échoue trop souvent
        // est désactivée automatiquement plutôt que de continuer à générer
        // des erreurs indéfiniment à chaque cycle.
        const failures = (source.consecutive_failures ?? 0) + 1;
        const shouldDisable = failures >= MAX_CONSECUTIVE_FAILURES;
        const finalMessage = shouldDisable
          ? `${message} Source désactivée automatiquement après ${failures} échecs consécutifs.`
          : message;

        // last_synced_at est mis à jour même en cas d'échec : sans cela, une
        // source durablement en panne resterait en tête de file et bloquerait
        // toutes les autres à chaque cycle.
        await supabase
          .from("user_sources")
          .update({
            last_synced_at: new Date().toISOString(),
            last_test_status: "error",
            last_test_message: finalMessage,
            consecutive_failures: failures,
            active: shouldDisable ? false : true,
          })
          .eq("id", source.id);
      }
    }

    return new Response(
      JSON.stringify({
        sourcesProcessed: sourceList.length + dueSources.length,
        articlesInserted: totalArticlesInserted,
        topicMatches: totalTopicMatches,
        userSourcesQueued: allDue.length,
        userSourcesRemaining: Math.max(0, allDue.length - dueSources.length),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ingestion-scheduler : exception non rattrapée", err);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});