import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0faf0",
          100: "#d5f0d4",
          200: "#ace0aa",
          300: "#7dcc79",
          400: "#51b849",
          500: "#3da03a",
          600: "#2d7e2a",
          700: "#00a64f",
          800: "#007a3a",
          900: "#005127",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
