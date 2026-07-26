/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0f172a',
        secondary: '#1e293b',
        accent: '#334155',
        success: '#15803d',
        warning: '#b45309',
        error: '#b91c1c',
        border: '#e2e8f0',
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.625rem',
        '2xl': '0.75rem',
      },
    },
  },
  plugins: [],
}
