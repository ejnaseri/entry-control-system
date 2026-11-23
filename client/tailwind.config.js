/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#b5d4ff",
          300: "#8bbcff",
          400: "#5397ff",
          500: "#2a74ff",
          600: "#1f5ae6",
          700: "#1743b4",
          800: "#133689",
          900: "#0f2a65",
        },
        surface: {
          DEFAULT: "#0f172a",
          muted: "#1e293b",
          border: "#243047",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Vazirmatn"', '"Noto Nastaliq Urdu"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
