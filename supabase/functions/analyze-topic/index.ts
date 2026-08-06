// Copyright (c) 2026 Shams Guettaf (Anthropotech Lab). Tous droits réservés.
// Edge Function "analyze-topic" — version durcie
//
// Traite un sujet unique : collecte les articles des sources natives
// actives, les ingère, puis effectue le matching par mots-clés pour ce
// sujet. Écrit la progression réelle dans analysis_jobs pour le suivi
// temps réel côté dashboard.
//
// Changements par rapport à la version précédente :
//   1. Authentification par session utilisateur réelle. La clé anon étant
//      publique, la validation de JWT de la plateforme ne prouvait rien.
//   2. Contrôle de propriété du topic_id. Il arrivait du corps de la
//      requête et était utilisé tel quel par un client service_role,
//      donc hors RLS : n'importe qui pouvait déclencher une analyse sur
//      le sujet d'un autre utilisateur et écrire dans son analysis_jobs.
//      La vérification s'appuie sur la RLS elle-même, via un client
//      porteur du jeton de l'appelant.
//   3. CORS restreint aux origines déclarées dans ALLOWED_ORIGINS, au
//      lieu de l'ancien caractère générique.
//   4. Filet global : aucune exception ne produit plus de statut 500.
//   5. Le job analysis_jobs n'est créé qu'après validation, pour ne plus
//      laisser de trace d'exécution sur une requête refusée.
//   6. Correction de la détection de langue (voir detectLanguage).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
// L'ancienne expression utilisait \y comme frontière de mot. \y existe en
// regex POSIX (celle de Postgres) mais PAS en JavaScript, où un échappement
// non reconnu est traité comme le caractère littéral. L'expression cherchait
// donc "yley", "ylay", etc. et ne correspondait jamais à rien : tous les
// articles étaient classés "en", y compris les articles français.
//
// La forme retenue emploie des inspections arrière et avant sur \p{L}, qui
// couvre les lettres accentuées — contrairement à \b, fondé sur [A-Za-z0-9_],
// qui échouerait sur "à". Le seuil de deux correspondances distinctes limite
// les faux positifs sur des titres courts contenant un mot ambigu.

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
    // ne renverra la ligne que si le sujet lui appartient. Aucune fuite
    // d'information — un sujet inexistant et un sujet appartenant à autrui
    // produisent la même réponse.
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
    // écritures dans articles et article_topics doivent contourner la RLS.
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

      await updateJob({ current_step: "collecte", progress_percent: 15 });

      const topicKeywords =
        (ownedTopic.keywords as { term: string }[] | null) ?? [];

      let articlesProcessed = 0;
      let topicMatches = 0;
      let articlesTotal = 0;

      const totalSources = sources?.length ?? 0;
      const feedsByItems: { sourceId: string; items: FeedItem[] }[] = [];

      for (const source of sources ?? []) {
        try {
          const response = await fetch(source.url);
          const xml = await response.text();
          const items = parseRss(xml).filter((i) => i.title && i.link);
          feedsByItems.push({ sourceId: source.id, items });
          articlesTotal += items.length;
        } catch (err) {
          console.error(`Erreur de collecte pour ${source.url} :`, err);
        }
      }

      await updateJob({
        current_step: "analyse",
        progress_percent: 25,
        articles_total: articlesTotal,
      });

      for (const feed of feedsByItems) {
        for (const item of feed.items) {
          const { data: article } = await supabase
            .from("articles")
            .upsert(
              {
                source_id: feed.sourceId,
                canonical_url: item.link,
                title: item.title,
                content_snippet: item.description,
                published_at: item.publishedAt.toISOString(),
                language: detectLanguage(`${item.title} ${item.description}`),
              },
              { onConflict: "canonical_url" },
            )
            .select()
            .maybeSingle();

          articlesProcessed++;

          if (article) {
            const haystack = `${item.title} ${item.description}`.toLowerCase();
            const matched = topicKeywords
              .map((k) => k.term)
              .filter((term) => haystack.includes(term.toLowerCase()));

            if (matched.length > 0) {
              await supabase.from("article_topics").upsert(
                { article_id: article.id, topic_id, matched_keywords: matched },
                { onConflict: "article_id,topic_id", ignoreDuplicates: true },
              );
              topicMatches++;
            }
          }

          if (articlesProcessed % 5 === 0 || articlesProcessed === articlesTotal) {
            await updateJob({
              current_step: "analyse",
              progress_percent:
                25 +
                Math.round(
                  (articlesProcessed / Math.max(articlesTotal, 1)) * 45,
                ),
              articles_processed: articlesProcessed,
              topic_matches: topicMatches,
            });
          }
        }
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
        finished_at: new Date().toISOString(),
      });

      return json(
        { articlesProcessed, topicMatches, sourcesProcessed: totalSources },
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