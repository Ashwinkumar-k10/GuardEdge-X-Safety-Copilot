/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          bg: '#090F1A',
          card: '#0F1626',
          border: 'rgba(255, 255, 255, 0.06)',
          orange: '#FF6B00',
          cyan: '#00F2FE',
          green: '#10B981',
          red: '#EF4444',
          yellow: '#FBBF24',
          gray: '#64748B',
        }
      },
      fontFamily: {
        mono: ['Roboto Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(15, 22, 38, 0.7) 0%, rgba(9, 15, 26, 0.8) 100%)',
        'orange-glow': 'radial-gradient(circle, rgba(255,107,0,0.15) 0%, rgba(255,107,0,0) 70%)',
        'cyan-glow': 'radial-gradient(circle, rgba(0,242,254,0.1) 0%, rgba(0,242,254,0) 70%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'cyan-glow': '0 0 15px rgba(0, 242, 254, 0.35)',
        'orange-glow': '0 0 15px rgba(255, 107, 0, 0.35)',
        'red-glow': '0 0 20px rgba(239, 68, 68, 0.5)',
      }
    },
  },
  plugins: [],
}
