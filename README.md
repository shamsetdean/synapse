# Synapse

Plateforme de veille informationnelle intelligente  (beta)).

## Principe

Synapse permet de suivre l'actualité qui vous intéresse sans effort de recherche répété. L'utilisateur crée des **sujets de veille** (un nom et une liste de mots-clés) ; la plateforme collecte alors automatiquement et en continu les articles pertinents depuis diverses sources d'information, les associe aux sujets par correspondance de mots-clés, détecte leur langue, les dédoublonne et les présente dans un tableau de bord.

Chaque utilisateur dispose de son propre espace isolé : ses sujets, ses sources personnalisées, ses statistiques de veille. La collecte tourne en arrière-plan de façon planifiée, et une analyse dédiée se déclenche à la création de chaque nouveau sujet, avec un suivi de progression en temps réel.

## Technologies utilisées

- **Next.js 14** (App Router) et **React 18**
- **Supabase** : base de données PostgreSQL, authentification, Row Level Security, Realtime et Edge Functions (Deno)
- **CSS Modules** pour la mise en forme
- **recharts** pour les graphiques statistiques
- **@dnd-kit** pour la réorganisation par glisser-déposer
- **lucide-react** pour les icônes
- **GitHub Actions** pour la collecte planifiée
- Hébergement : **Vercel** (application) et **Supabase** (base et fonctions)

Sources de données : flux RSS de médias d'actualité, extensible aux sources personnalisées de l'utilisateur.

## Droits d'auteur

Copyright © 2026 Shams Guettaf — Anthropotech Lab. Tous droits réservés.

Le code source, l'identité visuelle et l'architecture de Synapse sont la propriété de leur auteur. Toute reproduction, distribution ou utilisation, totale ou partielle, sans autorisation écrite préalable est interdite.

Les articles collectés restent la propriété de leurs éditeurs et sources respectifs ; Synapse n'en affiche que les titres, métadonnées et liens vers les sources d'origine, à des fins de veille personnelle.
