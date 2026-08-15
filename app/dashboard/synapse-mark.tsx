"use client";

// Sigle repris à l'identique du fichier de charte : losange de quatre nœuds
// reliés, quatre nœuds secondaires et un centre. Les liaisons se tracent et
// s'effacent en boucle, les nœuds pulsent. Toutes les durées et tous les
// décalages sont ceux de la charte.
//
// ÉCART VOLONTAIRE demandé : la charte dessine le sigle à 30 pixels. Il est
// ici rendu à 60 pixels (augmenté sur demande du 15/08, précédemment 44px).
// Seule la taille d'affichage change ; le tracé, les proportions et les
// animations restent identiques.
//
// CORRECTIF (15/08) : les nœuds sont à 4 unités du bord du viewBox 0-40, et
// le halo de logoGlow déborde légèrement de leur propre contour. Un <svg>
// masque par défaut (overflow: hidden) tout ce qui dépasse son viewport : le
// halo des nœuds proches du bord (haut, gauche) était donc tronqué net,
// invisible à 44px mais bien visible à 60px. overflow: visible lève ce
// masquage.

export default function SynapseMark() {
  return (
  <svg
        width="60"
        height="60" viewBox="0 0 40 40" style={{ flexShrink: 0, overflow: "visible" }}
        aria-hidden="true">
        <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8b7cf6"></stop>
        <stop offset="100%" stopColor="#6d5fd0"></stop>
        </linearGradient>
        <filter id="logoGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="2.2" result="blur"></feGaussianBlur>
        <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
        </filter>
        </defs>
        <line x1="20" y1="4" x2="36" y2="20" stroke="url(#logoGrad)" strokeWidth="1.5" strokeDasharray="23" strokeDashoffset="23" pathLength="23">
        <animate attributeName="stroke-dashoffset" values="23;0;0;23" keyTimes="0;0.3;0.7;1" dur="3.1s" begin="0.1s" repeatCount="indefinite"></animate>
        </line>
        <line x1="36" y1="20" x2="20" y2="36" stroke="url(#logoGrad)" strokeWidth="1.5" strokeDasharray="23" strokeDashoffset="23" pathLength="23">
        <animate attributeName="stroke-dashoffset" values="23;0;0;23" keyTimes="0;0.3;0.7;1" dur="2.7s" begin="1.4s" repeatCount="indefinite"></animate>
        </line>
        <line x1="20" y1="36" x2="4" y2="20" stroke="url(#logoGrad)" strokeWidth="1.5" strokeDasharray="23" strokeDashoffset="23" pathLength="23">
        <animate attributeName="stroke-dashoffset" values="23;0;0;23" keyTimes="0;0.3;0.7;1" dur="3.4s" begin="0.6s" repeatCount="indefinite"></animate>
        </line>
        <line x1="4" y1="20" x2="20" y2="4" stroke="url(#logoGrad)" strokeWidth="1.5" strokeDasharray="23" strokeDashoffset="23" pathLength="23">
        <animate attributeName="stroke-dashoffset" values="23;0;0;23" keyTimes="0;0.3;0.7;1" dur="2.9s" begin="2.1s" repeatCount="indefinite"></animate>
        </line>
        <line x1="20" y1="4" x2="20" y2="20" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.6" strokeDasharray="16" strokeDashoffset="16" pathLength="16">
        <animate attributeName="stroke-dashoffset" values="16;0;0;16" keyTimes="0;0.3;0.7;1" dur="2.5s" begin="0.9s" repeatCount="indefinite"></animate>
        </line>
        <line x1="36" y1="20" x2="20" y2="20" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.6" strokeDasharray="16" strokeDashoffset="16" pathLength="16">
        <animate attributeName="stroke-dashoffset" values="16;0;0;16" keyTimes="0;0.3;0.7;1" dur="3.2s" begin="0.3s" repeatCount="indefinite"></animate>
        </line>
        <line x1="20" y1="36" x2="20" y2="20" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.6" strokeDasharray="16" strokeDashoffset="16" pathLength="16">
        <animate attributeName="stroke-dashoffset" values="16;0;0;16" keyTimes="0;0.3;0.7;1" dur="2.8s" begin="1.7s" repeatCount="indefinite"></animate>
        </line>
        <line x1="4" y1="20" x2="20" y2="20" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.6" strokeDasharray="16" strokeDashoffset="16" pathLength="16">
        <animate attributeName="stroke-dashoffset" values="16;0;0;16" keyTimes="0;0.3;0.7;1" dur="3.6s" begin="0.5s" repeatCount="indefinite"></animate>
        </line>
        <circle cx="20" cy="4" r="3.4" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="r" values="3.4;3.4;6.4;3.4;3.4" keyTimes="0;0.42;0.5;0.58;1" dur="2.9s" begin="0.15s" repeatCount="indefinite"></animate>
        <animate attributeName="opacity" values="0.8;0.8;1;0.8;0.8" keyTimes="0;0.42;0.5;0.58;1" dur="2.9s" begin="0.15s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="36" cy="20" r="3.4" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="r" values="3.4;3.4;6.4;3.4;3.4" keyTimes="0;0.42;0.5;0.58;1" dur="3.5s" begin="0.9s" repeatCount="indefinite"></animate>
        <animate attributeName="opacity" values="0.8;0.8;1;0.8;0.8" keyTimes="0;0.42;0.5;0.58;1" dur="3.5s" begin="0.9s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="20" cy="36" r="3.4" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="r" values="3.4;3.4;6.4;3.4;3.4" keyTimes="0;0.42;0.5;0.58;1" dur="2.6s" begin="1.6s" repeatCount="indefinite"></animate>
        <animate attributeName="opacity" values="0.8;0.8;1;0.8;0.8" keyTimes="0;0.42;0.5;0.58;1" dur="2.6s" begin="1.6s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="4" cy="20" r="3.4" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="r" values="3.4;3.4;6.4;3.4;3.4" keyTimes="0;0.42;0.5;0.58;1" dur="3.1s" begin="0.5s" repeatCount="indefinite"></animate>
        <animate attributeName="opacity" values="0.8;0.8;1;0.8;0.8" keyTimes="0;0.42;0.5;0.58;1" dur="3.1s" begin="0.5s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="12" cy="12" r="1.8" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="opacity" values="0.45;0.45;1;0.45;0.45" keyTimes="0;0.32;0.42;0.5;1" dur="2.7s" begin="0.35s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="28" cy="12" r="1.8" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="opacity" values="0.45;0.45;1;0.45;0.45" keyTimes="0;0.32;0.42;0.5;1" dur="3.3s" begin="1.1s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="28" cy="28" r="1.8" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="opacity" values="0.45;0.45;1;0.45;0.45" keyTimes="0;0.32;0.42;0.5;1" dur="2.4s" begin="1.9s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="12" cy="28" r="1.8" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="opacity" values="0.45;0.45;1;0.45;0.45" keyTimes="0;0.32;0.42;0.5;1" dur="3.6s" begin="0.7s" repeatCount="indefinite"></animate>
        </circle>
        <circle cx="20" cy="20" r="2.4" fill="url(#logoGrad)" filter="url(#logoGlow)">
        <animate attributeName="r" values="2.4;2.4;4.8;2.4;2.4" keyTimes="0;0.46;0.5;0.54;1" dur="3.0s" begin="0.25s" repeatCount="indefinite"></animate>
        <animate attributeName="opacity" values="0.65;0.65;1;0.65;0.65" keyTimes="0;0.46;0.5;0.54;1" dur="3.0s" begin="0.25s" repeatCount="indefinite"></animate>
        </circle>
        </svg>
  );
}
