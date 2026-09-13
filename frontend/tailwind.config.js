/** @type {import('tailwindcss').Config} */
// Light, activity-app look: white surfaces, soft shadows for depth instead of dark
// borders, and a deep teal accent used sparingly for CTAs and key numbers — energetic
// and Strava-adjacent without borrowing its orange or its exact layout.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
        },
      },
      fontFamily: {
        display: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        pop: '0 4px 14px rgba(13, 148, 136, 0.25)',
      },
    },
  },
  plugins: [],
};
