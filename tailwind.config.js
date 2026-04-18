/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0A0F1E',
          800: '#111827',
          700: '#1F2937',
        },
        electric: {
          blue: '#2563EB',
          light: '#3B82F6',
        }
      }
    },
  },
  plugins: [],
}
