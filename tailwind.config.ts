import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sy: {
          bg: "var(--sy-bg)",
          text: "var(--sy-text)",
          "text-secondary": "var(--sy-text-secondary)",
          muted: "var(--sy-muted)",
          "muted-dim": "var(--sy-muted-dim)",
          "card-bg": "var(--sy-card-bg)",
          "card-bg-hover": "var(--sy-card-bg-hover)",
          border: "var(--sy-border)",
          "border-strong": "var(--sy-border-strong)",
          "input-bg": "var(--sy-input-bg)",
          "header-bg": "var(--sy-header-bg)",
          accent: "var(--sy-accent)",
          "accent-deep": "var(--sy-accent-deep)",
          "accent-text": "var(--sy-accent-text)",
          "grid-line": "var(--sy-grid-line)",
          "aurora-top": "var(--sy-aurora-top)",
          "aurora-bottom": "var(--sy-aurora-bottom)",
          "ring-center": "var(--sy-ring-center)",
          "chip-bg": "var(--sy-chip-bg)",
          "chip-border": "var(--sy-chip-border)",
          success: "var(--sy-success)",
          alert: "var(--sy-alert)",
          white: "var(--sy-white)",
        },
      },
      fontFamily: {
        sans: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        "sy-card": "var(--sy-radius-card)",
        "sy-card-lg": "var(--sy-radius-card-lg)",
        "sy-btn-primary": "var(--sy-radius-btn-primary)",
        "sy-btn-primary-sm": "var(--sy-radius-btn-primary-sm)",
        "sy-btn-secondary": "var(--sy-radius-btn-secondary)",
        "sy-icon": "var(--sy-radius-icon)",
        "sy-badge": "var(--sy-radius-badge)",
        "sy-input": "var(--sy-radius-input)",
        "sy-input-sm": "var(--sy-radius-input-sm)",
      },
      backdropBlur: {
        glass: "20px",
      },
      backgroundImage: {
        "sy-accent-gradient": "var(--sy-accent-gradient)",
      },
    },
  },
  plugins: [],
};

export default config;
