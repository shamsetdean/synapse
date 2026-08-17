import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import ThemeToggle from "./theme-toggle";
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

  const favoritedIds = (favoriteRows ?? []).map((r) => r.article_id as string);
  const dismissedIds = new Set(
    (dismissedRows ?? []).map((r) => r.article_id as string),
  );

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
  const logo = (
    <>
      <SynapseMark />
      <div className={styles.brandText}>
        <div className={styles.brandName}>SYNAPSE</div>
        <div className={styles.brandBadge}>VEILLE INTELLIGENTE</div>
      </div>
    </>
  );

  const accountBlock = (
    <>
      <div className={styles.accountRow}>
        <ThemeToggle />
        <SignOutButton />
      </div>
      <span className={styles.email}>{user.email}</span>
    </>
  );

  const articlesSection = (
    <div className={styles.main}>
      <div className={styles.articleHead}>
        <h2 className={styles.sectionH2}>Articles</h2>
      </div>
      {articles.length === 0 ? (
        <ArticlesEmptyState />
      ) : (
        <ArticleFeed articles={articles} favoritedIds={favoritedIds} />
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
