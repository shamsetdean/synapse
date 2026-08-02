import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./landing.module.css";
import LandingEditor from "./landing-editor";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    isAdmin = profile?.is_admin ?? false;

    if (!isAdmin) {
      redirect("/dashboard");
    }
  }

  const { data: layout } = await supabase
    .from("site_layout")
    .select("blocks")
    .eq("id", "landing")
    .maybeSingle();

  const blocks =
    (layout?.blocks as { id: string; visible: boolean }[] | null) ?? [
      { id: "hero", visible: true },
      { id: "features", visible: true },
      { id: "articles", visible: true },
      { id: "steps", visible: true },
    ];

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
          <Link href={isAdmin ? "/dashboard" : "/login"} className={styles.btn}>
            {isAdmin ? "Aller au dashboard" : "Se connecter"}
          </Link>
        </nav>

        <LandingEditor initialBlocks={blocks} isAdmin={isAdmin} />

        <footer>
          <span>Synapse — Anthropotech Lab</span>
          <span>Tous droits réservés</span>
        </footer>
      </div>
    </div>
  );
}
