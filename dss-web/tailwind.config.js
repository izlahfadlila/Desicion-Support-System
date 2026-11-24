/** @type {import('tailwindcss').Config} */
// Color palette: #3b5998, #8b9dc3, #dfe3ee, #f7f7f7, #ffffff
const brand = {
  50: "#f7f7f7",
  100: "#dfe3ee",
  200: "#dfe3ee",
  300: "#8b9dc3",
  400: "#8b9dc3",
  500: "#3b5998",
  600: "#3b5998",
  700: "#2f4779",
  800: "#263a64",
  900: "#1e2f52",
};

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // All former blue / green / orange / purple tones now use the palette
        blue: brand,
        indigo: brand,
        purple: brand,
        green: brand,
        emerald: brand,
        amber: { ...brand, 50: "#dfe3ee", 100: "#c4cce0", 200: "#8b9dc3", 700: "#2f4779" },
        gray: { 50: "#f7f7f7", 100: "#dfe3ee" },
        navy: {
          50: "#f7f7f7",
          100: "#dfe3ee",
          600: "#3b5998",
          700: "#3b5998",
          800: "#2f4779",
          900: "#3b5998",
          950: "#2f4779",
        },
      },
    },
  },
  plugins: [],
};
