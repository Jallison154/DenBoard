/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        charcoal: "#111827",
        slate: "#1F2933",
        sandstone: "#D1A37C",
        amberSoft: "#FBBF24",
        haze: "#6B7280"
      },
      fontFamily: {
        display: ["system-ui", "sans-serif"],
        body: ["system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
