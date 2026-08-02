import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Synapse</h1>
        <SignOutButton />
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        Connecté en tant que {user.email}
      </p>
    </main>
  );
}
