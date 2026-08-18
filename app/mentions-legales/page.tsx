import type { Metadata } from "next";
import Link from "next/link";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Mentions légales — Synapse",
  description: "Éditeur, directeur de publication et hébergeurs du site Synapse.",
};

// Brouillon rédigé à partir de l'inventaire réel du code (audit du 17/08/2026) :
// éditeur repris de LICENSE (branche main), hébergeurs vérifiés par recherche web
// (adresses Vercel et Supabase publiques, sources en pied de page). Aucune
// relecture juridique effectuée — voir l'avertissement affiché sur la page.
export default function MentionsLegalesPage() {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav>
          <div className={styles.logo}>
            <svg width="26" height="26" viewBox="0 0 26 26">
              <line x1="5" y1="5" x2="19" y2="5" stroke="var(--lavender)" strokeWidth="1.6" />
              <line x1="19" y1="5" x2="5" y2="19" stroke="var(--lavender)" strokeWidth="1.6" />
              <line x1="5" y1="19" x2="19" y2="19" stroke="var(--lavender)" strokeWidth="1.6" />
              <circle cx="5" cy="5" r="3" fill="var(--lavender-light)" />
              <circle cx="19" cy="5" r="3" fill="var(--violet-soft)" />
              <circle cx="5" cy="19" r="3" fill="var(--violet-soft)" />
              <circle cx="19" cy="19" r="3" fill="var(--lavender-light)" />
            </svg>
            Synapse
          </div>
        </nav>

        <div className={styles.legalWrap}>
          <Link href="/" className={styles.legalBackLink}>
            ← Retour à l&#8217;accueil
          </Link>

          <h1>Mentions légales</h1>
          <p className={styles.legalUpdated}>Dernière mise à jour : 17 août 2026</p>

          <div className={styles.legalNotice}>
            <strong>Brouillon en attente de relecture juridique.</strong> Ce contenu a
            été rédigé à partir de l&#8217;inventaire réel du projet et d&#8217;adresses
            d&#8217;hébergeurs vérifiées publiquement, mais aucun professionnel du droit
            ne l&#8217;a encore relu. Ne pas considérer comme définitif.
          </div>

          <section className={styles.legalSection}>
            <h2>Éditeur du site</h2>
            <p>
              Synapse est un projet personnel indépendant, sans forme commerciale ni
              affiliation, édité par :
            </p>
            <p>
              Shams Guettaf — Anthropotech Lab
              <br />
              Contact : <a href="mailto:shamsetdean@gmail.com">shamsetdean@gmail.com</a>
            </p>
            <p>
              En tant qu&#8217;éditeur personne physique à titre non professionnel,
              l&#8217;adresse postale et le numéro de téléphone ne sont pas publiés ici
              (faculté prévue par l&#8217;article 6-III de la LCEN) ; ils sont
              communicables sur demande motivée auprès des autorités compétentes, via
              les hébergeurs listés ci-dessous.
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Directeur de la publication</h2>
            <p>Shams Guettaf, en sa qualité d&#8217;éditeur du site.</p>
          </section>

          <section className={styles.legalSection}>
            <h2>Hébergement</h2>
            <p>
              <strong>Application (Next.js)</strong>
              <br />
              Vercel Inc.
              <br />
              340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis
              <br />
              <a href="https://vercel.com/legal" target="_blank" rel="noopener noreferrer">
                vercel.com/legal
              </a>
            </p>
            <p>
              <strong>Base de données, authentification et fonctions serveur</strong>
              <br />
              Supabase Pte Ltd
              <br />
              65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513
              <br />
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
                supabase.com/privacy
              </a>
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Propriété intellectuelle</h2>
            <p>
              Le code source, l&#8217;identité visuelle, le nom et le logo de Synapse
              sont la propriété de leur auteur. Toute reproduction, modification ou
              exploitation sans autorisation écrite préalable est interdite — voir le
              fichier LICENSE du dépôt.
            </p>
            <p>
              Les articles indexés par Synapse restent la propriété de leurs éditeurs et
              sources respectifs ; seuls leurs titres, métadonnées et liens vers la
              source d&#8217;origine sont affichés, à des fins de veille personnelle.
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Statut du projet</h2>
            <p>
              Synapse est un projet en développement actif, fourni « tel quel » sans
              garantie. Voir la politique de{" "}
              <Link href="/confidentialite">confidentialité</Link> pour le traitement
              des données personnelles.
            </p>
          </section>
        </div>

        <footer>
          <span>Synapse — Anthropotech Lab · Tous droits réservés</span>
          <div className={styles.footerLinks}>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/confidentialite">Confidentialité</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
