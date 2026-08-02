import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./landing.module.css";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav>
          <div className={styles.logo}>
            <svg width="26" height="26" viewBox="0 0 26 26">
              <line x1="5" y1="5" x2="19" y2="5" stroke="#c4b8ff" strokeWidth="1.6" />
              <line x1="19" y1="5" x2="5" y2="19" stroke="#c4b8ff" strokeWidth="1.6" />
              <line x1="5" y1="19" x2="19" y2="19" stroke="#c4b8ff" strokeWidth="1.6" />
              <circle cx="5" cy="5" r="3" fill="#e6e1ff" />
              <circle cx="19" cy="5" r="3" fill="#a89bf8" />
              <circle cx="5" cy="19" r="3" fill="#a89bf8" />
              <circle cx="19" cy="19" r="3" fill="#e6e1ff" />
            </svg>
            Synapse
          </div>
          <div className={styles.navLinks}>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#comment-ca-marche">Comment ça marche</a>
          </div>
          <Link href="/login" className={styles.btn}>
            Se connecter
          </Link>
        </nav>

        <section className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.pulseDot} /> Veille en temps réel
            </div>
            <h1>Toute l&#8217;actualité qui vous intéresse, connectée.</h1>
            <p className={styles.lede}>
              Créez vos sujets, laissez Synapse agréger, traduire et
              dédoublonner les articles de vos sources préférées — sans
              jamais rater l&#8217;essentiel.
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

        <section className={styles.features} id="fonctionnalites">
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>Fonctionnalités</div>
            <h2>Une veille qui travaille pour vous.</h2>
          </div>
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.icon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b8ff" strokeWidth="1.8">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <h3>Sources illimitées</h3>
              <p>RSS, réseaux sociaux, podcasts, communiqués officiels — centralisés au même endroit.</p>
            </div>
            <div className={styles.card}>
              <div className={styles.icon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b8ff" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
                </svg>
              </div>
              <h3>Traduction à la volée</h3>
              <p>Chaque article s&#8217;affiche dans votre langue, quelle que soit la source d&#8217;origine.</p>
            </div>
            <div className={styles.card}>
              <div className={styles.icon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b8ff" strokeWidth="1.8">
                  <path d="M9 3h6l3 5v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8z" />
                  <path d="M9 3v5H4" />
                </svg>
              </div>
              <h3>Zéro doublon</h3>
              <p>Les articles qui parlent du même événement sont automatiquement regroupés.</p>
            </div>
            <div className={styles.card}>
              <div className={styles.icon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4b8ff" strokeWidth="1.8">
                  <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
                  <path d="M10 20a2 2 0 0 0 4 0" />
                </svg>
              </div>
              <h3>Notifications intelligentes</h3>
              <p>Prévenu seulement quand plusieurs sources fiables confirment un événement.</p>
            </div>
          </div>
        </section>

        <section className={styles.steps} id="comment-ca-marche">
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>Comment ça marche</div>
            <h2>Trois étapes, zéro friction.</h2>
          </div>
          <div className={styles.stepsRow}>
            <div className={styles.stepLine} />
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <h3>Créez vos sujets</h3>
              <p>Nommez un sujet, ajoutez des mots-clés — Synapse s&#8217;occupe du reste.</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <h3>Laissez tourner</h3>
              <p>L&#8217;ingestion tourne en continu et remonte les articles pertinents.</p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <h3>Restez informé</h3>
              <p>Un flux clair, sans doublon, dans votre langue, en temps réel.</p>
            </div>
          </div>
        </section>

        <footer>
          <span>Synapse — Anthropotech Lab</span>
          <span>Tous droits réservés</span>
        </footer>
      </div>
    </div>
  );
}
