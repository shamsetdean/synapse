"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={signOut} className={styles.signOutBtn}>
      Se déconnecter
    </button>
  );
}
