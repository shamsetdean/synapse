// Copyright (c) 2026 Shams Guettaf (Anthropotech Lab). Tous droits réservés.
// Edge Function "test-source" — version de production
//
// Identique à la version durcie, avec trois différences :
// Teste une URL de flux RSS fournie par l'utilisateur avant qu'il ne
// l'ajoute comme source personnalisée.
//
// Protections :
//   - authentification par session utilisateur réelle (la clé anon étant
//     publique, la validation de JWT de la plateforme ne prouvait rien)
//   - garde-fou anti-SSRF sur toute récupération
//   - messages d'erreur génériques : distinguer un hôte injoignable d'un
//     port fermé transformerait la fonction en outil de reconnaissance
//   - CORS restreint aux origines déclarées dans ALLOWED_ORIGINS
//   - aucune exception ne peut produire de statut 500

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// Garde-fou anti-SSRF
// =============================================================================

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;

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
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new GuardError("HOTE_INTERDIT");
  if (!host.includes(".")) throw new GuardError("HOTE_NON_QUALIFIE");

  const resolver = (Deno as { resolveDns?: unknown }).resolveDns;
  if (typeof resolver !== "function") {
    console.log("test-source : Deno.resolveDns indisponible, controle DNS ignore");
    return;
  }

  let addresses: string[];
  try {
    addresses = await Deno.resolveDns(host, "A");
  } catch (err) {
    console.log("test-source : resolution DNS echouee", String(err));
    return;
  }

  if (!addresses || addresses.length === 0) return;

  for (const address of addresses) {
    const octets = parseIPv4(address);
    if (!octets || isNonPublicIPv4(octets)) throw new GuardError("ADRESSE_NON_PUBLIQUE");
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
    console.log(`test-source : saut ${hop} vers ${url.hostname}`);

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
    } catch (err) {
      console.log("test-source : fetch en echec", String(err));
      throw new GuardError("HOTE_INJOIGNABLE");
    }

    console.log(`test-source : statut ${response.status}`);

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

function publicErrorMessage(err: unknown): string {
  const code = err instanceof GuardError ? err.code : "INATTENDU";

  let base: string;
  switch (code) {
    case "URL_INVALIDE":
      base = "Cette URL n'est pas valide.";
      break;
    case "SCHEMA_INTERDIT":
      base = "Seules les adresses http et https sont acceptées.";
      break;
    case "ADRESSE_IP_LITTERALE":
    case "HOTE_INTERDIT":
    case "HOTE_NON_QUALIFIE":
    case "ADRESSE_NON_PUBLIQUE":
    case "IDENTIFIANTS_DANS_URL":
      base = "Cette adresse n'est pas autorisée.";
      break;
    case "REPONSE_TROP_VOLUMINEUSE":
      base = "La réponse de ce serveur est trop volumineuse.";
      break;
    case "TROP_DE_REDIRECTIONS":
      base = "Cette adresse comporte trop de redirections.";
      break;
    default:
      base = "Impossible de récupérer ce flux.";
  }

  return base;
}

// =============================================================================
// Fonction
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Filet global : aucune exception ne doit produire de statut 500, sinon
  // le client n'affiche qu'un message generique sans cause identifiable.
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (req.method !== "POST") {
      return json({ ok: false, error: "Méthode non autorisée" }, 405, origin);
    }

    // --- Authentification ---------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    let userId: string | null = null;

    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch (err) {
      console.log("test-source : verification de session en echec", String(err));
      return json(
        { ok: false, error: "Impossible de vérifier la session." },
        200,
        origin,
      );
    }

    if (!userId) {
      return json({ ok: false, error: "Authentification requise" }, 401, origin);
    }

    // --- Lecture de la requête ----------------------------------------------
    let url: unknown;
    try {
      const body = await req.json();
      url = body?.url;
    } catch {
      return json({ ok: false, error: "Corps de requête invalide" }, 400, origin);
    }

    if (typeof url !== "string" || url.length === 0 || url.length > 2048) {
      return json({ ok: false, error: "URL manquante ou invalide" }, 400, origin);
    }

    console.log(`test-source : demande pour ${url}`);

    // --- Récupération encadrée ----------------------------------------------
    let xml: string;
    try {
      xml = await safeFetchText(url);
    } catch (err) {
      console.log("test-source : recuperation refusee ou echouee", String(err));
      return json({ ok: false, error: publicErrorMessage(err) }, 200, origin);
    }

    console.log(`test-source : ${xml.length} caracteres recus`);

    // --- Analyse du flux ----------------------------------------------------
    const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

    if (items.length === 0) {
      return json(
        {
          ok: false,
          error:
            "Aucun article détecté. Ce n'est peut-être pas un flux RSS valide.",
        },
        200,
        origin,
      );
    }

    const feedTitleMatch = xml.match(
      /<channel>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i,
    );

    return json(
      {
        ok: true,
        feedTitle: feedTitleMatch ? stripCdata(feedTitleMatch[1]) : null,
        articleCount: items.length,
        firstArticleTitle: extractTag(items[0], "title"),
      },
      200,
      origin,
    );
  } catch (err) {
    console.log("test-source : exception non rattrapee", String(err));
    return json(
      { ok: false, error: "Erreur interne." },
      200,
      origin,
    );
  }
});