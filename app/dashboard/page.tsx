import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import NewTopicForm from "./new-topic-form";
import TopicSortableList from "./topic-sortable-list";
import ArticleFeed from "./article-feed";
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

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.topbar}>
          <div>
            <div className={styles.logo}>Synapse</div>
            <p className={styles.email}>Connecté en tant que {user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Nouveau sujet</span>
        </div>
        <NewTopicForm />

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Vos sujets</span>
        </div>
        <TopicSortableList initialTopics={topics ?? []} />

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Derniers articles</span>
        </div>
        <ArticleFeed articles={articles} />
      </div>
    </main>
  );
}
