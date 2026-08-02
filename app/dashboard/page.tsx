import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import NewTopicForm from "./new-topic-form";
import TopicSortableList from "./topic-sortable-list";
import ArticleFeed from "./article-feed";
import StatsPanel from "./stats-panel";
import UserSourcesPanel from "./user-sources-panel";
import DashboardShell from "./dashboard-shell";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const supabase = createClient();
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
    .limit(50);

  const { data: userSources } = await supabase
    .from("user_sources")
    .select("*")
    .order("created_at", { ascending: false });

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
      };
    })
    .filter((article): article is NonNullable<typeof article> => {
      if (!article || seen.has(article.id)) return false;
      seen.add(article.id);
      return true;
    });

  const logo = (
    <>
      <svg width="30" height="30" viewBox="0 0 26 26">
        <line x1="5" y1="5" x2="19" y2="5" stroke="#6d5fd0" strokeWidth="1.6" />
        <line x1="19" y1="5" x2="5" y2="19" stroke="#6d5fd0" strokeWidth="1.6" />
        <line x1="5" y1="19" x2="19" y2="19" stroke="#6d5fd0" strokeWidth="1.6" />
        <circle cx="5" cy="5" r="3" fill="#8b7cf6" />
        <circle cx="19" cy="5" r="3" fill="#6d5fd0" />
        <circle cx="5" cy="19" r="3" fill="#6d5fd0" />
        <circle cx="19" cy="19" r="3" fill="#8b7cf6" />
      </svg>
      <div>
        <div className={styles.logo}>Synapse</div>
        <p className={styles.email}>{user.email}</p>
      </div>
    </>
  );

  const dashboardSection = (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>01 — Nouveau sujet</span>
      </div>
      <NewTopicForm />

      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>02 — Vos sujets</span>
      </div>
      <TopicSortableList initialTopics={topics ?? []} />
    </>
  );

  const articlesSection = (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Articles collectés</span>
      </div>
      <ArticleFeed articles={articles} />
    </>
  );

  const statsSection = (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Statistiques de veille</span>
      </div>
      <StatsPanel userId={user.id} />
    </>
  );

  const sourcesSection = (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Sources connectées</span>
      </div>
      <UserSourcesPanel initialSources={userSources ?? []} />
    </>
  );

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <DashboardShell
          logo={logo}
          signOutButton={<SignOutButton />}
          dashboardSection={dashboardSection}
          articlesSection={articlesSection}
          statsSection={statsSection}
          sourcesSection={sourcesSection}
        />
      </div>
    </main>
  );
}
