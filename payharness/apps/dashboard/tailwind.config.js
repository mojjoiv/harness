/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f6f7fb',
        panel: '#ffffff',
        panelAlt: '#f1f4fb',
        ink: '#0f172a',
        muted: '#64748b',
        line: '#dbe3f0',
        brand: '#1d4ed8',
        brandSoft: '#dbeafe',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        xl2: '18px',
      },
    },
  },
  plugins: [],
};
