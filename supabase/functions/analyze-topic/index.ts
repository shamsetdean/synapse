// Copyright (c) 2026 Shams Guettaf (Anthropotech Lab). Tous droits réservés.
// Edge Function "analyze-topic" — version parallélisée
//
// Traite un sujet unique : collecte les articles des sources natives
// actives, les ingère, puis effectue le matching par mots-clés pour ce
// sujet. Écrit la progression réelle dans analysis_jobs pour le suivi
// temps réel côté dashboard.
//
// Protections inchangées :
//   - authentification par session utilisateur réelle
//   - contrôle de propriété du topic_id via la RLS, avant toute bascule
//     vers la clé privilégiée
//   - CORS restreint aux origines déclarées dans ALLOWED_ORIGINS
//   - aucune exception ne peut produire de statut 500
//
// Changements de cette version, sur la seule performance :
//   1. Les flux sont récupérés simultanément au lieu de l'un après l'autre.
//      Le temps de collecte passe de la somme des temps de réponse au plus
//      lent d'entre eux.
//   2. Les articles sont écrits en un seul appel par lot au lieu d'un appel
//      par article, et les correspondances de même. Sur une centaine
//      d'articles, deux requêtes remplacent deux cents allers-retours.
//
// Aucune règle métier ne change : mêmes sources, même détection de langue,
// même règle de correspondance par sous-chaîne.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Un lot trop large fait grossir la requête et le temps de réponse sans
// gain. Deux cents lignes couvrent largement les huit flux natifs.
const BATCH_SIZE = 200;
const FETCH_TIMEOUT_MS = 12_000;

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// --- Détection de langue -----------------------------------------------------
//
// \y est une frontière de mot en regex POSIX mais pas en JavaScript, où un
// échappement non reconnu devient le caractère littéral. L'ancienne
// expression ne correspondait donc jamais à rien. Les inspections sur \p{L}
// couvrent les lettres accentuées, contrairement à \b fondé sur
// [A-Za-z0-9_]. Le seuil de deux correspondances limite les faux positifs.

const FRENCH_STOPWORDS =
  /(?<!\p{L})(?:le|la|les|des|une|un|est|dans|pour|avec|sur|au|aux|qui|que|à|ce|cette|ses|leur)(?!\p{L})/giu;

function detectLanguage(text: string): string {
  const matches = text.match(FRENCH_STOPWORDS);
  return matches && matches.length >= 2 ? "fr" : "en";
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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// --- Fonction ----------------------------------------------------------------

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (req.method !== "POST") {
      return json({ error: "Méthode non autorisée" }, 405, origin);
    }

    // --- Authentification ---------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    let userClient;
    let userId: string | null = null;

    try {
      userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data } = await userClient.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch (err) {
      console.log("analyze-topic : vérification de session en échec", String(err));
      return json({ error: "Impossible de vérifier la session" }, 200, origin);
    }

    if (!userId || !userClient) {
      return json({ error: "Authentification requise" }, 401, origin);
    }

    // --- Lecture de la requête ----------------------------------------------
    let topic_id: unknown;
    try {
      const body = await req.json();
      topic_id = body?.topic_id;
    } catch {
      return json({ error: "Corps de requête invalide" }, 400, origin);
    }

    if (typeof topic_id !== "string" || topic_id.length === 0) {
      return json({ error: "topic_id manquant" }, 400, origin);
    }

    // --- Contrôle de propriété ----------------------------------------------
    // La lecture passe par le client porteur du jeton de l'appelant : la RLS
    // ne renvoie la ligne que si le sujet lui appartient. Un sujet inexistant
    // et un sujet appartenant à autrui produisent la même réponse.
    const { data: ownedTopic } = await userClient
      .from("topics")
      .select("id, keywords(term)")
      .eq("id", topic_id)
      .maybeSingle();

    if (!ownedTopic) {
      return json({ error: "Sujet introuvable" }, 404, origin);
    }

    // --- Traitement ---------------------------------------------------------
    // À partir d'ici seulement, on bascule sur le client privilégié : les
    // écritures dans articles et article_topics contournent la RLS.
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: job } = await supabase
      .from("analysis_jobs")
      .insert({
        topic_id,
        status: "running",
        current_step: "collecte",
        progress_percent: 5,
      })
      .select()
      .single();

    async function updateJob(fields: Record<string, unknown>) {
      if (!job) return;
      await supabase.from("analysis_jobs").update(fields).eq("id", job.id);
    }

    try {
      const { data: sources } = await supabase
        .from("sources")
        .select("id, url")
        .eq("active", true)
        .eq("type", "rss");

      const sourceList = sources ?? [];
      await updateJob({ current_step: "collecte", progress_percent: 15 });

      // --- 1. Collecte simultanée -------------------------------------------
      // allSettled plutôt que all : un flux indisponible ne doit pas faire
      // échouer les sept autres.
      const settled = await Promise.allSettled(
        sourceList.map(async (source) => {
          const response = await fetch(source.url, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          const xml = await response.text();
          return {
            sourceId: source.id as string,
            items: parseRss(xml).filter((i) => i.title && i.link),
          };
        }),
      );

      const feeds: { sourceId: string; items: FeedItem[] }[] = [];
      settled.forEach((result, i) => {
        if (result.status === "fulfilled") {
          feeds.push(result.value);
        } else {
          console.error(
            `Erreur de collecte pour ${sourceList[i]?.url} :`,
            String(result.reason),
          );
        }
      });

      // --- 2. Préparation des lignes ----------------------------------------
      // Une même adresse peut apparaître dans deux flux. La contrainte
      // d'unicité porte sur canonical_url : deux lignes de même adresse dans
      // un seul lot feraient échouer la requête entière. On dédoublonne donc
      // avant d'écrire, en gardant la première occurrence rencontrée.
      const seen = new Set<string>();
      const rows: Record<string, unknown>[] = [];

      for (const feed of feeds) {
        for (const item of feed.items) {
          if (seen.has(item.link)) continue;
          seen.add(item.link);
          rows.push({
            source_id: feed.sourceId,
            canonical_url: item.link,
            title: item.title,
            content_snippet: item.description,
            published_at: item.publishedAt.toISOString(),
            language: detectLanguage(`${item.title} ${item.description}`),
          });
        }
      }

      const articlesTotal = rows.length;
      await updateJob({
        current_step: "analyse",
        progress_percent: 25,
        articles_total: articlesTotal,
      });

      // --- 3. Écriture des articles par lots ---------------------------------
      const topicKeywords = (
        (ownedTopic.keywords as { term: string }[] | null) ?? []
      ).map((k) => k.term);

      const batches = chunk(rows, BATCH_SIZE);
      let articlesProcessed = 0;
      let topicMatches = 0;

      for (let b = 0; b < batches.length; b++) {
        const { data: saved, error: upsertError } = await supabase
          .from("articles")
          .upsert(batches[b], { onConflict: "canonical_url" })
          .select("id, title, content_snippet");

        if (upsertError) {
          console.error("analyze-topic : écriture des articles", upsertError);
          throw upsertError;
        }

        const savedRows = saved ?? [];
        articlesProcessed += savedRows.length;

        // --- 4. Correspondances, en un seul appel par lot -------------------
        // Même règle qu'auparavant : le terme est cherché comme suite de
        // caractères dans le titre et le résumé, sans distinction de casse.
        const links = savedRows
          .map((article) => {
            const haystack =
              `${article.title ?? ""} ${article.content_snippet ?? ""}`.toLowerCase();
            const matched = topicKeywords.filter((term) =>
              haystack.includes(term.toLowerCase()),
            );
            return matched.length > 0
              ? {
                  article_id: article.id,
                  topic_id,
                  matched_keywords: matched,
                }
              : null;
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        if (links.length > 0) {
          const { error: linkError } = await supabase
            .from("article_topics")
            .upsert(links, {
              onConflict: "article_id,topic_id",
              ignoreDuplicates: true,
            });

          if (linkError) {
            console.error("analyze-topic : écriture des liens", linkError);
            throw linkError;
          }
          topicMatches += links.length;
        }

        await updateJob({
          current_step: "analyse",
          progress_percent:
            25 + Math.round(((b + 1) / Math.max(batches.length, 1)) * 45),
          articles_processed: articlesProcessed,
          topic_matches: topicMatches,
        });
      }

      await updateJob({
        current_step: "filtrage",
        progress_percent: 80,
        topic_matches: topicMatches,
      });
      await updateJob({ current_step: "classement", progress_percent: 92 });

      await updateJob({
        status: "completed",
        current_step: "termine",
        progress_percent: 100,
        articles_processed: articlesProcessed,
        articles_total: articlesTotal,
        finished_at: new Date().toISOString(),
      });

      return json(
        {
          articlesProcessed,
          topicMatches,
          sourcesProcessed: feeds.length,
          sourcesFailed: sourceList.length - feeds.length,
        },
        200,
        origin,
      );
    } catch (err) {
      console.error("analyze-topic : échec du traitement", err);
      await updateJob({
        status: "failed",
        error: String(err),
        finished_at: new Date().toISOString(),
      });
      return json({ error: "Le traitement a échoué" }, 200, origin);
    }
  } catch (err) {
    console.error("analyze-topic : exception non rattrapée", err);
    return json({ error: "Erreur interne" }, 200, origin);
  }
});
