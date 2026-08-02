import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import NewTopicForm from "./new-topic-form";
import TopicCard from "./topic-card";
import ArticleFeed from "./article-feed";

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
    .select("id, name, status, keywords(id, term)")
    .order("created_at", { ascending: false });

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
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Synapse</h1>
        <SignOutButton />
      </div>

      <p className="mt-2 text-sm text-neutral-500">
        Connecté en tant que {user.email}
      </p>

      <h2 className="mt-8 text-sm font-medium text-neutral-700">
        Nouveau sujet
      </h2>
      <div className="mt-3">
        <NewTopicForm />
      </div>

      <h2 className="mt-8 text-sm font-medium text-neutral-700">
        Vos sujets
      </h2>
      <div className="mt-3 space-y-3">
        {!topics || topics.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Aucun sujet pour l&apos;instant. Créez-en un ci-dessus.
          </p>
        ) : (
          topics.map((topic) => <TopicCard key={topic.id} topic={topic} />)
        )}
      </div>

      <h2 className="mt-8 text-sm font-medium text-neutral-700">
        Derniers articles
      </h2>
      <div className="mt-3">
        <ArticleFeed articles={articles} />
      </div>
    </main>
  );
}
