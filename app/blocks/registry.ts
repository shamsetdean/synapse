import Hero from "./Hero";
import Features from "./Features";
import ArticleCards from "./ArticleCards";
import Steps from "./Steps";

export const blockRegistry = {
  hero: { label: "En-tête", Component: Hero },
  features: { label: "Fonctionnalités", Component: Features },
  articles: { label: "Aperçu des articles", Component: ArticleCards },
  steps: { label: "Comment ça marche", Component: Steps },
} as const;

export type BlockId = keyof typeof blockRegistry;
