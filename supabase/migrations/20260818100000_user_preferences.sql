-- =============================================================================
-- Synapse — Préférences d'affichage des articles (par utilisateur)
-- Date : 18 août 2026
--
-- Portée :
--   Nouvelle table user_preferences : tri des articles, densité d'affichage,
--   champs visibles sur chaque card. Une ligne par utilisateur, créée à la
--   première sauvegarde de préférences (pas de déclencheur à l'inscription,
--   contrairement à profiles — une valeur par défaut suffit tant que
--   l'utilisateur n'a rien réglé, cf. la validation défensive côté
--   application plutôt qu'ici).
--
-- Suit le même patron que toutes les autres tables par utilisateur du
-- projet (favorites, dismissed_articles, user_sources, notification_rules) :
-- une table dédiée, policy "for all" sur (select auth.uid()) = user_id,
-- restreinte au rôle authenticated. Pas de colonne ajoutée sur profiles,
-- dont la surface d'écriture a été délibérément réduite au strict minimum
-- lors du correctif de sécurité du 6 août (élévation de privilège sur
-- is_admin) — y ajouter des préférences UI reviendrait sur ce choix sans
-- nécessité.
--
-- sort_by/density : ensembles de valeurs fixes et connus, en colonnes
-- texte contraintes plutôt qu'en jsonb. visible_fields : jsonb, parce que
-- la liste des champs activables sur une card est plus susceptible de
-- s'étendre plus tard — même logique que site_layout.blocks, dont la
-- validation défensive côté serveur (filtrer l'inconnu, compléter le
-- manquant) sera reprise ici au moment du chargement, pas dans cette
-- migration.
--
-- Pas de déclencheur pour updated_at : aucune autre table du projet n'en
-- a, la colonne est toujours positionnée explicitement par l'appelant au
-- moment de l'écriture (voir le patron déjà utilisé pour site_layout).
--
-- Idempotente : IF NOT EXISTS sur la table, DROP POLICY IF EXISTS avant
-- CREATE POLICY. Ré-exécutable sans effet de bord.
-- Transactionnel : en cas d'erreur, rien n'est appliqué.
-- =============================================================================

begin;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sort_by text not null default 'date'
    check (sort_by in ('date', 'source', 'topic')),
  density text not null default 'comfortable'
    check (density in ('compact', 'comfortable')),
  visible_fields jsonb not null default '{"source": true, "freshness": true, "summary": true}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

-- Fermeture par défaut, puis octroi explicite du strict nécessaire : pas de
-- delete, aucun cas d'usage ne le demande (la suppression de compte purge
-- la ligne via le on delete cascade de la clé étrangère, pas une action de
-- l'utilisateur).
revoke all on table public.user_preferences from anon, authenticated;
grant select, insert, update on table public.user_preferences to authenticated;

drop policy if exists user_preferences_all_own on public.user_preferences;

create policy user_preferences_all_own
  on public.user_preferences
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
