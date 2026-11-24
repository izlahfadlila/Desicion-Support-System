/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4ff",
          100: "#e0eaff",
          600: "#2d4a8a",
          700: "#1e3a6e",
          800: "#162d57",
          900: "#0f2040",
          950: "#091529",
        },
      },
    },
  },
  plugins: [],
};
