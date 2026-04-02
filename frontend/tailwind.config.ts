import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chrome: {
          950: "#070b14",
          900: "#0d1322",
          800: "#121b2f",
          700: "#19304d",
          500: "#42d7ff",
          400: "#79e2ff",
          300: "#b1efff",
          accent: "#7cff9f",
          warn: "#ffc65c"
        }
      },
      boxShadow: {
        panel: "0 24px 70px rgba(0, 0, 0, 0.35)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(121,226,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(121,226,255,0.08) 1px, transparent 1px)"
      },
      fontFamily: {
        display: ["'Avenir Next'", "'Segoe UI'", "sans-serif"],
        mono: ["'SFMono-Regular'", "Menlo", "Monaco", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;

