"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    // replace plutôt que push : après une déconnexion, le bouton retour du
    // navigateur ne doit pas ramener sur l'écran précédent, qui afficherait
    // brièvement le contenu du compte avant que la redirection ne s'applique.
    router.replace("/login");
    router.refresh();
  }

  return (
    <button onClick={signOut} className={styles.signOutBtn}>
      Déconnexion
    </button>
  );
}
