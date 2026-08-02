import styles from "../landing.module.css";

export default function Steps() {
  return (
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
  );
}
