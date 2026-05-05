/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        zamtel: {
          green: '#00843D',
          'green-dark': '#006B31',
          'green-light': '#00A84F',
          pink: '#E4007C',
          'pink-dark': '#B8005F',
          'pink-light': '#FF3399',
        },
      },
    },
  },
  plugins: [],
};
