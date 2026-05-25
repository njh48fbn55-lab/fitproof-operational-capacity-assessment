import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        blacktop: "#050505",
        graphite: "#1C1C1C",
        charcoal: "#2B2B2B",
        slate: "#6D6D6D",
        fitgreen: "#67a629",
        greenline: "#8bbf5a",
        mist: "#F4F7F2",
        cream: "#F7F7F4",
        panel: "#FAFAF7",
        paper: "#ffffff",
        line: "#E3E3DD"
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
