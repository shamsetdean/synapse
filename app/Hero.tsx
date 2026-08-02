import Link from "next/link";
import styles from "../landing.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div>
        <div className={styles.eyebrow}>
          <span className={styles.pulseDot} /> Veille en temps réel
        </div>
        <h1>Toute l&#8217;actualité qui vous intéresse, connectée.</h1>
        <p className={styles.lede}>
          Créez vos sujets, laissez Synapse agréger, traduire et dédoublonner
          les articles de vos sources préférées — sans jamais rater
          l&#8217;essentiel.
        </p>
        <div className={styles.heroActions}>
          <Link href="/login" className={`${styles.btn} ${styles.btnPrimary}`}>
            Commencer gratuitement
          </Link>
          <a href="#comment-ca-marche" className={styles.btn}>
            Voir comment ça marche
          </a>
        </div>
      </div>

      <div className={styles.heroVisual}>
        <svg viewBox="0 0 400 340" width="100%" height="100%">
          <defs>
            <radialGradient id="g1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8b7cf6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#8b7cf6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <line x1="80" y1="60" x2="180" y2="40" stroke="#8b7cf6" strokeWidth="1" opacity="0.5" />
          <line x1="180" y1="40" x2="260" y2="90" stroke="#8b7cf6" strokeWidth="1" opacity="0.5" />
          <line x1="260" y1="90" x2="220" y2="160" stroke="#8b7cf6" strokeWidth="1" opacity="0.5" />
          <line x1="220" y1="160" x2="120" y2="150" stroke="#8b7cf6" strokeWidth="1" opacity="0.5" />
          <line x1="120" y1="150" x2="140" y2="230" stroke="#8b7cf6" strokeWidth="1" opacity="0.5" />
          <line x1="140" y1="230" x2="240" y2="260" stroke="#8b7cf6" strokeWidth="1" opacity="0.5" />
          <line x1="240" y1="260" x2="300" y2="200" stroke="#8b7cf6" strokeWidth="0.7" opacity="0.3" />
          <line x1="260" y1="90" x2="330" y2="70" stroke="#8b7cf6" strokeWidth="0.7" opacity="0.3" />
          <g>
            <circle cx="80" cy="60" r="20" fill="url(#g1)" /><circle cx="80" cy="60" r="4" fill="#c4b8ff" />
            <circle cx="180" cy="40" r="24" fill="url(#g1)" /><circle cx="180" cy="40" r="5" fill="#e6e1ff" />
            <circle cx="260" cy="90" r="20" fill="url(#g1)" /><circle cx="260" cy="90" r="4" fill="#a89bf8" />
            <circle cx="220" cy="160" r="26" fill="url(#g1)" /><circle cx="220" cy="160" r="5.5" fill="#e6e1ff" />
            <circle cx="120" cy="150" r="18" fill="url(#g1)" /><circle cx="120" cy="150" r="4" fill="#a89bf8" />
            <circle cx="140" cy="230" r="20" fill="url(#g1)" /><circle cx="140" cy="230" r="4" fill="#c4b8ff" />
            <circle cx="240" cy="260" r="22" fill="url(#g1)" /><circle cx="240" cy="260" r="4.5" fill="#a89bf8" />
            <circle cx="300" cy="200" r="14" fill="url(#g1)" opacity="0.8" /><circle cx="300" cy="200" r="3" fill="#c4b8ff" />
            <circle cx="330" cy="70" r="14" fill="url(#g1)" opacity="0.8" /><circle cx="330" cy="70" r="3" fill="#a89bf8" />
          </g>
        </svg>
      </div>
    </section>
  );
}
