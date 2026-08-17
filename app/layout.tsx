import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import ThemeProvider from "./theme-provider";
import "./globals.css";

// Évite le flash du mauvais thème : ce script doit s'exécuter avant
// l'hydratation React (strategy="beforeInteractive" ci-dessous), donc rester
// une chaîne autonome sans import. La clé de stockage est dupliquée dans
// app/theme-provider.tsx — garder les deux synchronisées.
// Par défaut (rien en localStorage, prefers-color-scheme indisponible) :
// DARK, comme demandé.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("synapse-theme");
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

// Les polices de la charte étaient chargées par un @import vers les serveurs
// de Google en tête de dashboard.module.css. Deux conséquences : le texte
// sautait d'une police système à la police finale au premier affichage, et
// l'adresse IP de chaque visiteur était transmise à un tiers.
//
// next/font télécharge les mêmes fichiers à la compilation et les sert depuis
// le domaine du site. Mêmes familles, mêmes graisses, rendu identique.
//
// Les noms de variables reprennent ceux déjà employés par les styles
// existants, qui continuent donc de fonctionner sans modification.

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Synapse",
  description: "Votre espace de veille personnalisé",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
      // Le script bloquant ci-dessous pose data-theme sur <html> avant que
      // React n'hydrate : sans cette option, React signalerait un attribut
      // "en trop" par rapport au rendu serveur, qui ne peut pas connaître la
      // préférence système ou le choix mémorisé du visiteur.
      suppressHydrationWarning
    >
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
