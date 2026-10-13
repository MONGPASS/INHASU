/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#0f766e",
        "primary-dark": "#115e59",
        "background-light": "#ffffff",
        "background-dark": "#12201d",
        "surface-light": "#ffffff",
        "surface-dark": "#1e1e1e",
        // Travel Mates specific
        "card-light": "#ffffff",
        "card-dark": "#1b2733",
        "text-main-light": "#191f28",
        "text-main-dark": "#eef1f4",
        "text-sub-light": "#8b95a1",
        "text-sub-dark": "#9aaab9",
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'toss': '0 2px 8px 0 rgba(0, 0, 0, 0.04)',
        'toss-hover': '0 4px 16px 0 rgba(0, 0, 0, 0.08)',
      },
      fontFamily: {
        "display": ["Pretendard", "-apple-system", "BlinkMacSystemFont", "Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
        "sans": ["Pretendard", "-apple-system", "BlinkMacSystemFont", "Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "full": "9999px"
      },
      animation: {
        "scroll-vertical": "scroll-vertical 20s linear infinite"
      },
      keyframes: {
        "scroll-vertical": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-50%)" }
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
