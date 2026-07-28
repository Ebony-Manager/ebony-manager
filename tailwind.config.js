/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ebony: {
          dark:   '#2C1A0E',
          medium: '#5C3A1E',
          light:  '#8B5E3C',
          warm:   '#FAF7F2',
          gray:   '#E8E2D9',
          gold:   '#C9A84C',
          'gold-light': '#E2C87A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
