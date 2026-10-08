/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          900: '#0B0E11',
          800: '#14181D',
          700: '#1C222B',
          600: '#262F3C',
          500: '#343E4F',
          border: '#232A34',
        },
        honey: {
          DEFAULT: '#F2B705',
          light: '#F7D774',
          dark: '#D99B00',
          glow: 'rgba(242, 183, 5, 0.15)',
        },
        healthy: '#39D98A',
        warning: '#FFB020',
        critical: '#FF5C5C',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
      }
    },
  },
  plugins: [],
}
