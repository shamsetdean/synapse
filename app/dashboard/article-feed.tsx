import styles from "./dashboard.module.css";

type FeedArticle = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  topicName: string;
};

function timeAgo(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export default function ArticleFeed({
  articles,
}: {
  articles: FeedArticle[];
}) {
  if (articles.length === 0) {
    return (
      <p className={styles.emptyState}>
        Aucun article pour l&apos;instant. L&apos;ingestion n&apos;a peut-être
        pas encore trouvé de correspondance avec vos mots-clés.
      </p>
    );
  }

  return (
    <div className={styles.articleList}>
      {articles.map((article) => (
        <a
          key={article.id}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.articleCard}
        >
          <div className={styles.articleMeta}>
            <span className={styles.articleTopicTag}>{article.topicName}</span>
            <span>
              {article.sourceName} · {timeAgo(article.publishedAt)}
            </span>
          </div>
          <h3 className={styles.articleTitle}>{article.title}</h3>
        </a>
      ))}
    </div>
  );
}
