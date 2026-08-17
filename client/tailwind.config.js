/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          50: "#f2f6f1",
          100: "#e1ebde",
          200: "#c3d7bd",
          300: "#9cbc93",
          400: "#749d69",
          500: "#54804c",
          600: "#41663b",
          700: "#355131",
          800: "#2c4229",
          900: "#253723",
        },
      },
    },
  },
  plugins: [],
};
