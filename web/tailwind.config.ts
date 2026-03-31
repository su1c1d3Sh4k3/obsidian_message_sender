import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "sans-serif"],
      },
      colors: {
        background: "#09090b",
        surface: {
          DEFAULT: "#0c0c0f",
          dim: "#0c0c0f",
          bright: "#18181b",
          container: {
            lowest: "#09090b",
            low: "#0f0f12",
            DEFAULT: "#121215",
            high: "#18181b",
            highest: "#1e1e22",
          },
          variant: "#18181b",
          tint: "#a78bfa",
        },
        primary: {
          DEFAULT: "#a78bfa",
          container: "#7c3aed",
          fixed: { DEFAULT: "#ede9fe", dim: "#c4b5fd" },
        },
        secondary: {
          DEFAULT: "#71717a",
          container: "#27272a",
          fixed: { DEFAULT: "#a1a1aa", dim: "#71717a" },
        },
        tertiary: {
          DEFAULT: "#34d399",
          container: "#065f46",
          fixed: { DEFAULT: "#bbf7d0", dim: "#6ee7b7" },
        },
        error: {
          DEFAULT: "#ef4444",
          container: "#3b1111",
        },
        outline: {
          DEFAULT: "#52525b",
          variant: "#27272a",
        },
        on: {
          surface: "#fafafa",
          "surface-variant": "#a1a1aa",
          background: "#fafafa",
          primary: "#0a0012",
          "primary-container": "#ede9fe",
          "primary-fixed": "#2e1065",
          "primary-fixed-variant": "#5b21b6",
          secondary: "#09090b",
          "secondary-container": "#a1a1aa",
          "secondary-fixed": "#18181b",
          "secondary-fixed-variant": "#3f3f46",
          tertiary: "#001a12",
          "tertiary-container": "#bbf7d0",
          "tertiary-fixed": "#003318",
          "tertiary-fixed-variant": "#047857",
          error: "#1a0000",
          "error-container": "#fca5a5",
        },
        inverse: {
          surface: "#fafafa",
          "on-surface": "#09090b",
          primary: "#5b21b6",
        },
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
