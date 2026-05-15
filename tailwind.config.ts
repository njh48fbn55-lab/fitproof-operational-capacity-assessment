import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211d",
        slate: "#36423d",
        moss: "#315446",
        copper: "#a15d3a",
        cream: "#f7f3ea",
        paper: "#fffdf8",
        line: "#ded7c8"
      },
      boxShadow: {
        soft: "0 22px 70px rgba(23, 33, 29, 0.12)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"]
      }
    }
  },
  plugins: []
};

export default config;
