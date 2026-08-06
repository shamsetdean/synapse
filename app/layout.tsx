import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

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
    >
      <body>{children}</body>
    </html>
  );
}
