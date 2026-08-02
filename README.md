# Synapse

Plateforme de veille professionnelle personnalisée — PWA Next.js + Supabase.

## Mise en route

1. Copier `.env.example` vers `.env.local` et renseigner les valeurs depuis
   Supabase (**Project Settings → API**) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Pousser ce dossier sur GitHub (nouveau dépôt `synapse`).
3. Importer le dépôt sur Vercel : Vercel détecte automatiquement Next.js,
   installe les dépendances et build sans commande locale.
4. Renseigner les mêmes variables d'environnement dans
   **Vercel → Project Settings → Environment Variables**.
5. Une fois déployé, ajouter l'URL Vercel de production dans :
   - Supabase → **Authentication → URL Configuration** (Site URL + Redirect URLs)
   - Google Cloud Console → OAuth Client → Authorized JavaScript origins
   - GitHub OAuth App → Homepage URL

## Icônes PWA manquantes

`public/manifest.json` référence `icon-192.png` et `icon-512.png`, à ajouter
dans `public/` avant le premier déploiement (sinon l'installation PWA échoue
silencieusement sur certains navigateurs).
