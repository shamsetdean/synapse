import type { Metadata } from "next";
import Link from "next/link";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Confidentialité — Synapse",
  description:
    "Données personnelles collectées par Synapse, finalités, sous-traitants et droits des utilisateurs.",
};

// Brouillon rédigé à partir de l'inventaire réel du code (audit du 17/08/2026) :
// tables et flux de données lus directement dans le projet, pas déduits ni
// génériques. Aucune relecture juridique effectuée — voir l'avertissement
// affiché sur la page, notamment sur la base légale exacte de chaque
// traitement et le statut des transferts hors UE.
export default function ConfidentialitePage() {
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

          <h1>Politique de confidentialité</h1>
          <p className={styles.legalUpdated}>Dernière mise à jour : 18 août 2026</p>

          <div className={styles.legalNotice}>
            <strong>Brouillon en attente de relecture juridique.</strong> Le contenu
            reflète fidèlement ce que le code du projet fait réellement aujourd&#8217;hui,
            mais la base légale de chaque traitement et le statut des transferts hors UE
            n&#8217;ont pas été validés par un professionnel du droit. Voir les
            avertissements dans chaque section concernée.
          </div>

          <section className={styles.legalSection}>
            <h2>Responsable du traitement</h2>
            <p>
              Shams Guettaf — Anthropotech Lab, éditeur de Synapse. Contact pour toute
              question relative à vos données :{" "}
              <a href="mailto:shamsetdean@gmail.com">shamsetdean@gmail.com</a>.
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Données collectées</h2>
            <p>Synapse traite les données suivantes, et aucune autre :</p>
            <ul>
              <li>
                <strong>Compte</strong> : adresse email et identifiant de compte,
                transmis par le fournisseur de connexion choisi (Google ou GitHub) au
                moment de l&#8217;inscription.
              </li>
              <li>
                <strong>Sujets de veille</strong> : noms et mots-clés que vous créez.
              </li>
              <li>
                <strong>Sources personnalisées</strong> : adresses des flux RSS que vous
                ajoutez.
              </li>
              <li>
                <strong>Interactions avec les articles</strong> : ceux que vous mettez
                en favori ou écartez.
              </li>
              <li>
                <strong>Préférence de langue d&#8217;affichage</strong>, si vous la
                modifiez.
              </li>
            </ul>
            <p>
              Synapse ne demande ni ne stocke aucune donnée de paiement, ne suit aucune
              localisation, et ne dépose aucun cookie ou traceur publicitaire ou
              analytique — voir la section « Cookies » ci-dessous.
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Finalités et base légale</h2>
            <p>
              Ces données servent exclusivement à faire fonctionner le service que vous
              avez demandé : collecter et faire correspondre des articles à vos sujets
              de veille, et vous les présenter dans votre tableau de bord personnel.
            </p>
            <p>
              La base légale est l&#8217;exécution du contrat qui vous lie à Synapse dès
              la création de votre compte (article 6.1.b du RGPD).{" "}
              <em>
                Point à faire confirmer par un professionnel : la qualification exacte
                (contrat vs. intérêt légitime) selon les fonctionnalités.
              </em>
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Destinataires et sous-traitants</h2>
            <p>Vos données ne sont jamais vendues ni partagées à des fins publicitaires. Elles transitent par deux prestataires techniques :</p>
            <ul>
              <li>
                <strong>Supabase</strong> (base de données, authentification, fonctions
                serveur) — entité singapourienne, voir les{" "}
                <Link href="/mentions-legales">mentions légales</Link>.
              </li>
              <li>
                <strong>Vercel</strong> (hébergement de l&#8217;application) — entité
                américaine, voir les <Link href="/mentions-legales">mentions légales</Link>.
              </li>
            </ul>
            <p>
              <em>
                Point à faire confirmer par un professionnel : le statut exact des
                transferts hors Union européenne vers ces deux prestataires (clauses
                contractuelles types ou mécanisme équivalent) n&#8217;a pas été vérifié
                pour ce projet.
              </em>
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Durée de conservation</h2>
            <p>
              Vos données sont conservées tant que votre compte reste actif, et au
              maximum 12 mois après votre dernière connexion. Passé ce délai
              d&#8217;inactivité, votre compte et les données associées (sujets, sources,
              favoris, articles écartés) sont supprimés automatiquement.
            </p>
            <p>
              Un email vous est envoyé un mois avant cette suppression : il vous suffit
              de vous reconnecter avant l&#8217;échéance si vous souhaitez conserver votre
              compte.
            </p>
            <p>
              Une suppression de compte à votre demande (voir « Vos droits »
              ci-dessous) entraîne la suppression immédiate de ces mêmes données.
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Cookies</h2>
            <p>
              Synapse dépose un seul cookie : celui de votre session de connexion,
              strictement nécessaire pour rester identifié entre deux visites. Aucun
              cookie de mesure d&#8217;audience, publicitaire ou de réseau social
              n&#8217;est utilisé. Ce cookie étant indispensable au fonctionnement du
              service que vous demandez, aucun consentement préalable n&#8217;est requis
              pour son dépôt (article 82 de la loi Informatique et Libertés).
            </p>
            <p>
              Les polices de caractères du site sont servies directement depuis ce
              domaine, sans appel à un service tiers.
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Vos droits</h2>
            <p>
              Conformément au RGPD, vous disposez d&#8217;un droit d&#8217;accès, de
              rectification, d&#8217;effacement et de portabilité de vos données, ainsi
              que d&#8217;un droit d&#8217;opposition. Pour l&#8217;exercer, écrivez à{" "}
              <a href="mailto:shamsetdean@gmail.com">shamsetdean@gmail.com</a> : votre
              demande sera traitée sous un mois.
            </p>
            <p>
              Vous pouvez également introduire une réclamation auprès de la CNIL (
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
                cnil.fr
              </a>
              ) si vous estimez que vos droits ne sont pas respectés.
            </p>
          </section>

          <section className={styles.legalSection}>
            <h2>Sécurité</h2>
            <p>
              Les échanges avec le site sont chiffrés (HTTPS). L&#8217;accès aux données
              est cloisonné par utilisateur au niveau de la base de données elle-même
              (Row Level Security) : un compte ne peut techniquement pas lire les sujets,
              sources ou favoris d&#8217;un autre compte.
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
