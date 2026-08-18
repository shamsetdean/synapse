import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileMenu from "./profile-menu";
import SynapseMark from "./synapse-mark";
import NewTopicForm from "./new-topic-form";
import TopicSortableList from "./topic-sortable-list";
import ArticleFeed from "./article-feed";
import ArticlesEmptyState from "./articles-empty-state";
import StatsPanel from "./stats-panel";
import UserSourcesPanel from "./user-sources-panel";
import DashboardShell from "./dashboard-shell";
import ConfigView from "./config-view";
import styles from "./dashboard.module.css";

type SortBy = "date" | "source" | "topic";
type Density = "compact" | "comfortable";
type VisibleFields = { source: boolean; freshness: boolean; summary: boolean };
type UserPreferences = {
  sortBy: SortBy;
  density: Density;
  visibleFields: VisibleFields;
};

// Valeurs par défaut : utilisées tant qu'aucune ligne user_preferences
// n'existe encore pour cet utilisateur (avant son premier réglage), et pour
// compléter tout champ manquant ou invalide dans une ligne existante.
const DEFAULT_PREFERENCES: UserPreferences = {
  sortBy: "date",
  density: "comfortable",
  visibleFields: { source: true, freshness: true, summary: true },
};

function isSortBy(value: unknown): value is SortBy {
  return value === "date" || value === "source" || value === "topic";
}

function isDensity(value: unknown): value is Density {
  return value === "compact" || value === "comfortable";
}

// visible_fields est une colonne jsonb : sa forme n'est garantie ni par les
// types ni par une contrainte en base, contrairement à sort_by/density (déjà
// verrouillées par un CHECK). Même logique défensive que normalizeBlocks
// pour site_layout.blocks — filtrer/compléter plutôt que faire confiance.
function normalizeVisibleFields(raw: unknown): VisibleFields {
  const source = raw as Record<string, unknown> | null | undefined;
  return {
    source:
      typeof source?.source === "boolean"
        ? source.source
        : DEFAULT_PREFERENCES.visibleFields.source,
    freshness:
      typeof source?.freshness === "boolean"
        ? source.freshness
        : DEFAULT_PREFERENCES.visibleFields.freshness,
    summary:
      typeof source?.summary === "boolean"
        ? source.summary
        : DEFAULT_PREFERENCES.visibleFields.summary,
  };
}

function normalizePreferences(
  raw: { sort_by?: unknown; density?: unknown; visible_fields?: unknown } | null | undefined,
): UserPreferences {
  return {
    sortBy: isSortBy(raw?.sort_by) ? raw.sort_by : DEFAULT_PREFERENCES.sortBy,
    density: isDensity(raw?.density) ? raw.density : DEFAULT_PREFERENCES.density,
    visibleFields: normalizeVisibleFields(raw?.visible_fields),
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: topics } = await supabase
    .from("topics")
    .select("id, name, status, sort_order, keywords(id, term)")
    .order("sort_order", { ascending: true });

  const { data: articleTopics } = await supabase
    .from("article_topics")
    .select(
      "articles(id, title, canonical_url, published_at, sources(name)), topics(name)",
    )
    .order("published_at", { foreignTable: "articles", ascending: false })
    .limit(150);

  const { data: userSources } = await supabase
    .from("user_sources")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: favoriteRows } = await supabase
    .from("favorites")
    .select("article_id");

  const { data: dismissedRows } = await supabase
    .from("dismissed_articles")
    .select("article_id");

  const { data: preferencesRow } = await supabase
    .from("user_preferences")
    .select("sort_by, density, visible_fields")
    .eq("user_id", user.id)
    .maybeSingle();

  const preferences = normalizePreferences(preferencesRow);

  const favoritedIds = (favoriteRows ?? []).map((r) => r.article_id as string);
  const dismissedIds = new Set(
    (dismissedRows ?? []).map((r) => r.article_id as string),
  );

  // Ordre des groupes de sujets dans le fil d'articles : hérité de
  // topics.sort_order, déjà appliqué par la requête ci-dessus (.order sur
  // sort_order). Pas de nouvel état, pas de nouvelle interface — le
  // glisser-déposer de l'onglet Sujets de veille suffit.
  const topicOrder = (topics ?? []).map((t) => t.name);

  // Server Component : rendu une fois par requête, jamais réexécuté côté client.
  // L'âge est calculé ici précisément pour éviter la divergence d'hydratation
  // que produisait le même appel dans article-feed.tsx.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const seen = new Set<string>();
  const articles = (articleTopics ?? [])
    .map((row) => {
      const article = row.articles as unknown as {
        id: string;
        title: string;
        canonical_url: string;
        published_at: string;
        sources: { name: string } | null;
      } | null;
      const topic = row.topics as unknown as { name: string } | null;
      if (!article) return null;
      return {
        id: article.id,
        title: article.title,
        url: article.canonical_url,
        sourceName: article.sources?.name ?? "Source inconnue",
        publishedAt: article.published_at,
        topicName: topic?.name ?? "",
        ageHours: (nowMs - new Date(article.published_at).getTime()) / 3600000,
      };
    })
    .filter((article): article is NonNullable<typeof article> => {
      if (!article || seen.has(article.id)) return false;
      if (dismissedIds.has(article.id)) return false;
      seen.add(article.id);
      return true;
    });

  // Bloc d'identité de la charte : sigle animé, nom en capitales, badge.
  // ÉCARTS VOLONTAIRES demandés : le badge est placé sous le nom plutôt qu'à
  // côté, et l'adresse de courriel passe sous le bouton de déconnexion.
  //
  // Indicateur LIVE (structure v2, section 3) : purement décoratif, même
  // registre que le "Veille en temps réel" de la page d'accueil — pas un
  // état de connexion réel, donc le dot reste aria-hidden et c'est le texte
  // "LIVE" qui porte le sens pour les lecteurs d'écran.
  const logo = (
    <>
      <SynapseMark />
      <div className={styles.brandText}>
        <div className={styles.brandName}>SYNAPSE</div>
        <div className={styles.brandBadge}>VEILLE INTELLIGENTE</div>
      </div>
      <span className={styles.liveIndicator}>
        <span className={styles.liveDot} aria-hidden="true" />
        LIVE
      </span>
    </>
  );

  const accountBlock = <ProfileMenu email={user.email ?? ""} />;

  const articlesSection = (
    <div className={styles.main}>
      <div className={styles.articleHead}>
        <h2 className={styles.sectionH2}>Articles</h2>
      </div>
      {articles.length === 0 ? (
        <ArticlesEmptyState />
      ) : (
        <ArticleFeed
          articles={articles}
          favoritedIds={favoritedIds}
          topicOrder={topicOrder}
          sortBy={preferences.sortBy}
          density={preferences.density}
        />
      )}
    </div>
  );

  // Le titre, le compteur et la barre d'outils de réorganisation sont rendus
  // par TopicSortableList : la charte les place sur une même ligne, or l'état
  // du mode réorganisation vit dans ce composant.
  const dashboardSection = (
    <div className={`${styles.main} ${styles.mainTopics}`}>
      {/* La clé intègre le statut : sans lui, une mise en pause ne changeait
          aucun identifiant, donc rien ne se remontait et l'affichage restait
          figé jusqu'au rechargement de la page. */}
      <TopicSortableList
        key={(topics ?? []).map((t) => `${t.id}:${t.status}`).join(",")}
        initialTopics={topics ?? []}
      />
      <NewTopicForm />
    </div>
  );

  const configSection = (
    <div className={`${styles.main} ${styles.mainConfig}`}>
      <ConfigView
        stats={<StatsPanel userId={user.id} />}
        sources={<UserSourcesPanel initialSources={userSources ?? []} />}
      />
    </div>
  );

  return (
    <main className={styles.page}>
      <DashboardShell
        logo={logo}
        signOutButton={accountBlock}
        dashboardSection={dashboardSection}
        articlesSection={articlesSection}
        configSection={configSection}
      />
    </main>
  );
}
