import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "oklch(22% 0.02 250)",
        paper: "oklch(98.3% 0.006 90)",
        surface: "oklch(99.4% 0.003 90)",
        muted: "oklch(52% 0.02 250)",
        border: "oklch(89% 0.012 250)",
        primary: {
          DEFAULT: "oklch(38% 0.09 175)",
          hover: "oklch(32% 0.095 175)",
          soft: "oklch(94% 0.03 175)",
        },
        accent: {
          DEFAULT: "oklch(72% 0.12 80)",
          soft: "oklch(95% 0.035 80)",
        },
        danger: {
          DEFAULT: "oklch(55% 0.18 25)",
          soft: "oklch(95% 0.04 25)",
        },
      },
      fontFamily: {
        display: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px oklch(22% 0.02 250 / 0.04), 0 8px 24px oklch(22% 0.02 250 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
