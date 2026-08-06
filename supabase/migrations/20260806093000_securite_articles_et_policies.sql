-- =============================================================================
-- Synapse — Correctif de sécurité 2/2
-- Date : 6 août 2026
-- Prérequis : le correctif 1/2 doit avoir été appliqué.
--
-- Portée :
--   A. Fuite inter-utilisateurs : articles / events / event_articles étaient
--      lisibles par tout utilisateur authentifie, y compris les articles issus
--      des flux prives (user_sources) d'un autre utilisateur.
--   D. Toutes les policies passent en forme (select auth.uid()) et sont
--      restreintes au role authenticated.
--
-- Pourquoi (select auth.uid()) : sous cette forme, Postgres evalue la fonction
-- une seule fois en InitPlan au lieu de la reevaluer pour chaque ligne examinee.
-- L'ecart devient determinant des que articles et article_topics grossissent.
--
-- Pourquoi TO authenticated : sans clause de role, une policy s'applique au
-- pseudo-role PUBLIC, donc son expression est evaluee aussi pour anon.
--
-- Transactionnel : en cas d'erreur, rien n'est applique.
-- =============================================================================

begin;

-- =============================================================================
-- Index de support
-- =============================================================================
-- La nouvelle policy de articles remonte article_topics puis topics. La
-- contrainte unique (article_id, topic_id) couvre deja le premier saut ; le
-- second a besoin d'un index sur topics.user_id.

create index if not exists idx_topics_user_id on public.topics (user_id);
create index if not exists idx_article_topics_topic_id on public.article_topics (topic_id);

-- =============================================================================
-- A. articles — visibilite par correspondance de sujet
-- =============================================================================
-- Un article est visible s'il est rattache, via article_topics, a l'un des
-- sujets de l'appelant. C'est exactement ce que le dashboard affiche : il
-- interroge article_topics et remonte les articles par jointure imbriquee,
-- jamais articles en direct. Aucune regression d'affichage attendue.
--
-- Effet de bord assume : un article ingere mais ne correspondant a aucun de vos
-- sujets n'est plus lisible. Il ne l'etait deja plus a l'ecran.

drop policy if exists articles_select_authenticated on public.articles;

create policy articles_select_own_topics
  on public.articles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.article_topics at
      join public.topics t on t.id = at.topic_id
      where at.article_id = articles.id
        and t.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- A (suite). events / event_articles — retour au refus par defaut
-- =============================================================================
-- Ces tables portaient la meme policy permissive que articles et ne sont lues
-- par aucun composant du dashboard. La deduplication multi-sources annoncee
-- n'est pas implementee (1 article = 1 evenement). On retire les policies de
-- lecture : la RLS reste active, donc refus par defaut.
--
-- L'ingestion ecrit avec la cle service_role, qui contourne la RLS : le
-- pipeline n'est pas affecte. Les policies adaptees seront ecrites le jour ou
-- la fonctionnalite sera reellement utilisee.

drop policy if exists events_select_authenticated on public.events;
drop policy if exists event_articles_select_authenticated on public.event_articles;

revoke all on table public.events from anon, authenticated;
revoke all on table public.event_articles from anon, authenticated;

-- =============================================================================
-- D. Reecriture des policies restantes
-- =============================================================================
-- Aucun changement de semantique : memes conditions, forme optimisee et role
-- explicite. Les expressions sont reprises a l'identique du releve du 6 aout.

-- --- analysis_jobs ----------------------------------------------------------
drop policy if exists "Users can view their own analysis jobs" on public.analysis_jobs;

create policy analysis_jobs_select_own
  on public.analysis_jobs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.topics t
      where t.id = analysis_jobs.topic_id
        and t.user_id = (select auth.uid())
    )
  );

-- --- article_topics ---------------------------------------------------------
drop policy if exists article_topics_select_own_topic on public.article_topics;

create policy article_topics_select_own_topic
  on public.article_topics
  for select
  to authenticated
  using (
    exists (
      select 1 from public.topics t
      where t.id = article_topics.topic_id
        and t.user_id = (select auth.uid())
    )
  );

-- --- topics -----------------------------------------------------------------
drop policy if exists topics_all_own on public.topics;

create policy topics_all_own
  on public.topics
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- keywords ---------------------------------------------------------------
drop policy if exists keywords_all_own on public.keywords;

create policy keywords_all_own
  on public.keywords
  for all
  to authenticated
  using (
    exists (
      select 1 from public.topics t
      where t.id = keywords.topic_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.topics t
      where t.id = keywords.topic_id and t.user_id = (select auth.uid())
    )
  );

-- --- topic_source_rules -----------------------------------------------------
drop policy if exists topic_source_rules_all_own on public.topic_source_rules;

create policy topic_source_rules_all_own
  on public.topic_source_rules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.topics t
      where t.id = topic_source_rules.topic_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.topics t
      where t.id = topic_source_rules.topic_id and t.user_id = (select auth.uid())
    )
  );

-- --- user_sources -----------------------------------------------------------
drop policy if exists "Users manage their own sources" on public.user_sources;

create policy user_sources_all_own
  on public.user_sources
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- favorites --------------------------------------------------------------
drop policy if exists favorites_all_own on public.favorites;

create policy favorites_all_own
  on public.favorites
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- read_history -----------------------------------------------------------
drop policy if exists read_history_all_own on public.read_history;

create policy read_history_all_own
  on public.read_history
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- dismissed_articles -----------------------------------------------------
drop policy if exists "Users manage their own dismissed articles" on public.dismissed_articles;

create policy dismissed_articles_all_own
  on public.dismissed_articles
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- notifications ----------------------------------------------------------
drop policy if exists notifications_all_own on public.notifications;

create policy notifications_all_own
  on public.notifications
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- notification_rules -----------------------------------------------------
drop policy if exists notification_rules_all_own on public.notification_rules;

create policy notification_rules_all_own
  on public.notification_rules
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- sources ----------------------------------------------------------------
-- Les 8 sources natives sont un catalogue commun a la plateforme, sans donnee
-- personnelle. Lecture ouverte a tout compte authentifie, inchangee.

drop policy if exists sources_select_authenticated on public.sources;

create policy sources_select_authenticated
  on public.sources
  for select
  to authenticated
  using (true);

-- --- site_layout ------------------------------------------------------------
-- Lecture publique assumee (mise en page du site vitrine). Ecriture reservee
-- aux comptes administrateurs.

drop policy if exists site_layout_select_public on public.site_layout;
drop policy if exists site_layout_update_admin on public.site_layout;

create policy site_layout_select_public
  on public.site_layout
  for select
  to anon, authenticated
  using (true);

create policy site_layout_update_admin
  on public.site_layout
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

commit;
