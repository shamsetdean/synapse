/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // React n'utilise eval() qu'en développement (reconstruction de piles
    // d'appel pour les outils de debug) — jamais en production, d'après son
    // propre avertissement. 'unsafe-eval' n'est donc autorisé qu'en dev, pour
    // ne pas affaiblir la CSP réellement servie aux visiteurs.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    return [
      {
        // Toutes les routes. Pas de connexion à un domaine tiers (polices
        // auto-hébergées, pas de traceur) : la CSP peut rester stricte sans
        // liste d'exceptions à maintenir.
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
