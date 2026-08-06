-- =============================================================================
-- Synapse — Correctif de sécurité 1/2
-- Date : 6 août 2026
--
-- Portée :
--   B. Élévation de privilège : profiles.is_admin modifiable par son propriétaire
--   C. get_dashboard_stats : lisible pour n'importe quel utilisateur cible
--      + search_path non figé sur une fonction SECURITY DEFINER
--
-- Hors portée (correctif 2/2) :
--   A. Policies de lecture de articles / events / event_articles
--   D. Optimisation (select auth.uid()) sur l'ensemble des policies
--
-- Transactionnel : en cas d'erreur, rien n'est appliqué.
-- Ré-exécutable sans effet de bord.
-- =============================================================================

begin;

-- =============================================================================
-- B. profiles — suppression de l'élévation de privilège
-- =============================================================================

-- Un privilège UPDATE accordé au niveau table couvre toutes les colonnes et rend
-- inopérant tout REVOKE au niveau colonne. On révoque donc au niveau table,
-- puis on ré-accorde uniquement la colonne légitimement modifiable.

revoke all on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (display_language) on table public.profiles to authenticated;

-- Note : aucune INSERT n'est accordée. Les lignes de profiles sont créées par
-- le déclencheur handle_new_user (SECURITY DEFINER), qui n'est pas soumis à ces
-- privilèges. Aucune régression attendue sur l'inscription.

-- La policy UPDATE existante n'avait pas de WITH CHECK : Postgres réutilisait
-- alors silencieusement l'expression USING. On l'expose explicitement, et on
-- passe à la forme (select auth.uid()) pour une évaluation unique en InitPlan
-- plutôt qu'une réévaluation ligne à ligne.

drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- =============================================================================
-- C. get_dashboard_stats — cloisonnement et durcissement
-- =============================================================================

-- Trois changements, aucun sur la logique de calcul :
--   1. L'identifiant utilisateur est désormais déduit de auth.uid(), plus jamais
--      du paramètre client. Le paramètre devient optionnel et n'est accepté que
--      s'il correspond à l'appelant — la signature reste (uuid), donc l'appel
--      existant du dashboard continue de fonctionner sans modification.
--   2. search_path figé à '' : neutralise le détournement de résolution de noms,
--      classique sur les fonctions SECURITY DEFINER. Les tables sont déjà
--      qualifiées en public.*, et pg_catalog reste implicitement résolu.
--   3. Marquage STABLE : la fonction ne fait que lire.

create or replace function public.get_dashboard_stats(p_user_id uuid default null)
returns json
language plpgsql
security definer
stable
set search_path = ''
as $function$
DECLARE
  v_uid uuid := auth.uid();
  result json;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'get_dashboard_stats : appel non authentifie'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_uid THEN
    RAISE EXCEPTION 'get_dashboard_stats : acces interdit aux donnees d''un autre utilisateur'
      USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'total_found', (
      SELECT count(DISTINCT at.article_id)
      FROM public.article_topics at
      JOIN public.topics t ON t.id = at.topic_id
      WHERE t.user_id = v_uid
    ),
    'total_read', (
      SELECT count(*) FROM public.read_history WHERE user_id = v_uid
    ),
    'total_favorited', (
      SELECT count(*) FROM public.favorites WHERE user_id = v_uid
    ),
    'total_dismissed', (
      SELECT count(*) FROM public.dismissed_articles WHERE user_id = v_uid
    ),
    'new_last_24h', (
      SELECT count(DISTINCT at.article_id)
      FROM public.article_topics at
      JOIN public.topics t ON t.id = at.topic_id
      JOIN public.articles a ON a.id = at.article_id
      WHERE t.user_id = v_uid AND a.published_at > now() - interval '24 hours'
    ),
    'by_language', (
      SELECT COALESCE(json_agg(row_to_json(lang_counts)), '[]'::json)
      FROM (
        SELECT a.language, count(DISTINCT at.article_id) AS count
        FROM public.article_topics at
        JOIN public.topics t ON t.id = at.topic_id
        JOIN public.articles a ON a.id = at.article_id
        WHERE t.user_id = v_uid
        GROUP BY a.language
      ) lang_counts
    ),
    'by_source', (
      SELECT COALESCE(json_agg(row_to_json(source_counts)), '[]'::json)
      FROM (
        SELECT s.name, count(DISTINCT at.article_id) AS count
        FROM public.article_topics at
        JOIN public.topics t ON t.id = at.topic_id
        JOIN public.articles a ON a.id = at.article_id
        JOIN public.sources s ON s.id = a.source_id
        WHERE t.user_id = v_uid
        GROUP BY s.name
        ORDER BY count DESC
      ) source_counts
    ),
    'daily_evolution', (
      SELECT COALESCE(json_agg(row_to_json(daily)), '[]'::json)
      FROM (
        SELECT date_trunc('day', a.published_at)::date AS day,
               count(DISTINCT at.article_id) AS count
        FROM public.article_topics at
        JOIN public.topics t ON t.id = at.topic_id
        JOIN public.articles a ON a.id = at.article_id
        WHERE t.user_id = v_uid AND a.published_at > now() - interval '14 days'
        GROUP BY day
        ORDER BY day
      ) daily
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- Par défaut, CREATE FUNCTION accorde EXECUTE au pseudo-rôle PUBLIC, ce qui
-- inclut anon. On restreint explicitement aux utilisateurs authentifiés.

revoke all on function public.get_dashboard_stats(uuid) from public;
revoke all on function public.get_dashboard_stats(uuid) from anon;
grant execute on function public.get_dashboard_stats(uuid) to authenticated;

commit;
