/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Fundación CAP primary accents
        cyan: {
          DEFAULT: 'rgb(0, 138, 201)',
          50:  'rgb(230, 245, 252)',
          100: 'rgb(179, 223, 243)',
          200: 'rgb(102, 192, 229)',
          300: 'rgb(51, 165, 215)',
          400: 'rgb(0, 138, 201)',
          500: 'rgb(0, 112, 163)',
          600: 'rgb(0, 86, 126)',
        },
        magenta: {
          DEFAULT: 'rgb(228, 21, 105)',
          50:  'rgb(252, 230, 240)',
          100: 'rgb(246, 179, 210)',
          200: 'rgb(238, 109, 164)',
          300: 'rgb(232, 54, 130)',
          400: 'rgb(228, 21, 105)',
          500: 'rgb(185, 14, 84)',
          600: 'rgb(143, 8, 63)',
        },
        yellow: {
          DEFAULT: 'rgb(255, 220, 0)',
          50:  'rgb(255, 251, 204)',
          100: 'rgb(255, 244, 128)',
          200: 'rgb(255, 235, 51)',
          300: 'rgb(255, 220, 0)',
          400: 'rgb(204, 176, 0)',
        },
        // Secondary accent tones
        pink:    'rgb(226, 64, 142)',
        crimson: 'rgb(229, 53, 23)',
        purple1: 'rgb(179, 67, 120)',
        purple2: 'rgb(142, 69, 112)',
        // Neutral text & UI
        'gray-ui':   'rgb(160, 165, 169)',
        'gray-dark': 'rgb(51, 51, 51)',
        // Structural
        bg:     '#F5F6F8',
        border: '#E5E7EB',
        // Keep semaforo colors accessible via Tailwind
        'sem-green':  'rgb(0, 138, 201)',
        'sem-amber':  'rgb(255, 220, 0)',
        'sem-red':    'rgb(229, 53, 23)',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        light:   '300',
        regular: '400',
        medium:  '500',
        semibold:'600',
        bold:    '700',
      },
      boxShadow: {
        card: '0 1px 4px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        elev: '0 4px 16px -2px rgb(0 138 201 / 0.10)',
      },
    },
  },
  plugins: [],
}
