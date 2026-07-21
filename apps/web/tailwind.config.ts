import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        radar: {
          ink: "#17201a",
          panel: "#f7f8f3",
          line: "#dfe5da",
          teal: "#157f7b",
          gold: "#b98522",
          red: "#c2413b"
        }
      },
      boxShadow: {
        soft: "0 16px 40px rgba(23, 32, 26, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;

