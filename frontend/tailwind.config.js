/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0b1f35',       // Official dark government navy
          primary: '#1e3a8a',    // Deep administrative blue
          secondary: '#3b82f6',  // Accent blue
          surface: '#f8fafc',    // Clean background
          border: '#cbd5e1',     // Administrative border
          card: '#ffffff',       // Pure white card
          success: '#15803d',    // Official subtle green
          danger: '#b91c1c',     // Red error / warning
          muted: '#64748b',      // Subdued metadata text
        }
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '"Noto Sans Kannada"', 'system-ui', 'sans-serif'],
        kannada: ['"Noto Sans Kannada"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
