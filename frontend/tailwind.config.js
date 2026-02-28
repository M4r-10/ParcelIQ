/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0B1220',
          subtle: '#0E1525',
        },
        card: '#111827',
        primary: {
          DEFAULT: '#3B82F6',
          flood: '#2563EB',
        },
        risk: {
          red: '#EF4444',
          green: '#22C55E',
        },
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(59, 130, 246, 0.45)',
        'card-soft': '0 18px 45px rgba(15, 23, 42, 0.7)',
      },
      borderRadius: {
        xl: '1rem',
      },
      backgroundImage: {
        'radial-faded':
          'radial-gradient(circle at top, rgba(59, 130, 246, 0.25), transparent 60%)',
        'radial-faded-strong':
          'radial-gradient(circle at center, rgba(37, 99, 235, 0.4), transparent 65%)',
      },
    },
  },
  plugins: [],
};

