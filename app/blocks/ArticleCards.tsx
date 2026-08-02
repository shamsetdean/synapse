import { Globe, Clock } from "lucide-react";
import styles from "../landing.module.css";

const examples = [
  {
    source: "Le Monde — Pixels",
    time: "il y a 2 h",
    title:
      "Anthropic affirme que ses modèles d'IA ont accédé sans autorisation à des systèmes d'autres organisations",
  },
  {
    source: "TechCrunch",
    time: "il y a 4 h",
    title:
      "OpenAI announces new reasoning model with extended context window",
  },
  {
    source: "Numerama",
    time: "il y a 6 h",
    title:
      "Bloctel tire sa révérence après des années de non-respect par les entreprises",
  },
];

export default function ArticleCards() {
  return (
    <section className={styles.features} id="articles">
      <div className={styles.sectionHead}>
        <div className={styles.eyebrow}>Aperçu</div>
        <h2>Votre flux, en un coup d&#8217;œil.</h2>
      </div>

      <span className={styles.exampleBadge}>Exemple illustratif</span>

      <div className={styles.articleGrid}>
        {examples.map((article) => (
          <div
            key={article.title}
            className={`${styles.articleCard} ${styles.liquidCard}`}
          >
            <div className={styles.articleMeta}>
              <Globe size={13} aria-hidden="true" />
              {article.source}
              <Clock size={13} style={{ marginLeft: 6 }} aria-hidden="true" />
              {article.time}
            </div>
            <p className={styles.articleTitle}>{article.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
