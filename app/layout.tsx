import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
