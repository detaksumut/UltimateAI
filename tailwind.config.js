export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Overriding default indigo with APASIFIC Gold Palette
        indigo: {
          50: '#fdfbf6',
          100: '#fbf5ea',
          200: '#f4e7cd',
          300: '#edd5a8',
          400: '#DDBF67', // Light Gold for text highlights
          500: '#C9A84C', // APASIFIC Gold (Primary Accent)
          600: '#b8923a', // Gold Button background
          700: '#94722c', // Hover states
          800: '#795b27',
          900: '#644b24',
          950: '#3a2a12',
        },
        // Overriding default blue with APASIFIC Muted & Dark Palette
        blue: {
          50: '#fbfbfc',
          100: '#f5f5f7',
          200: '#e7e7eb',
          300: '#D1D5DB', // Muted body text
          400: '#9a9da8',
          500: '#8888AA', // Active icons / Muted blue-gray
          600: '#6b6b85',
          700: '#535368',
          800: '#2A2A35', // Card borders / input backgrounds
          900: '#151520',
          950: '#060610', // APASIFIC Main Dark Background
        }
      }
    },
  },
  plugins: [],
}
