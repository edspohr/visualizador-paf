/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1A365D',
          50:  '#E8EDF4',
          100: '#C5D1E2',
          200: '#9DB1CC',
          300: '#7591B6',
          400: '#4D71A0',
          500: '#2D5489',
          600: '#1A365D',
          700: '#142B4C',
          800: '#0F213B',
          900: '#0A172A',
        },
        sky: {
          DEFAULT: '#5B9BD5',
          50:  '#EEF5FB',
          100: '#D6E7F4',
          200: '#B1D0E8',
          300: '#8CB8DC',
          400: '#5B9BD5',
          500: '#4287C5',
          600: '#3370A8',
        },
        lime: {
          DEFAULT: '#8CC63F',
          50:  '#F2F9E7',
          100: '#DFF0C4',
          200: '#C5E593',
          300: '#A9D661',
          400: '#8CC63F',
          500: '#74A833',
          600: '#5B8528',
        },
        ink:   '#333333',
        muted: '#6B7280',
        bg:    '#F4F6F7',
        border: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        elev: '0 4px 12px -2px rgb(26 54 93 / 0.08)',
      }
    },
  },
  plugins: [],
}
