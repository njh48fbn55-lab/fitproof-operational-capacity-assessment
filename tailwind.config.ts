import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        slate: "#4b5563",
        moss: "#2563eb",
        copper: "#0f766e",
        cream: "#f8fafc",
        paper: "#ffffff",
        line: "#e5e7eb"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        serif: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
