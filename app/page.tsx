"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  async function signInWith(provider: "google" | "github") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-medium">Synapse</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Connectez-vous pour accéder à votre espace de veille
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signInWith("google")}
            className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
          >
            Continuer avec Google
          </button>
          <button
            onClick={() => signInWith("github")}
            className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
          >
            Continuer avec GitHub
          </button>
        </div>
      </div>
    </main>
  );
}
