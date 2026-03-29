/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // ── SmilePro Design System ─────────────────────────────
        primary:    '#002855',   // Deep Corporate Navy
        secondary:  '#0056b3',   // Original Gesden Blue
        accent:     '#00a6ff',   // Bright Action Blue
        corporate:  '#003a70',   // Clinical Corporate Blue
        surface:    '#ffffff',

        clinical: {
          navy:  '#001a35',              // Ultra Deep Navy
          teal:  '#0056b3',              // Corporate Primary
          soft:  '#e2e8f0',              // SmilePro background
          glass: 'rgba(255,255,255,0.9)',
        },

        // ── Colores semánticos (agenda) ────────────────────────
        sem: {
          red:    '#ef4444',  // Cirugía
          green:  '#10b981',  // Higiene
          blue:   '#3b82f6',  // Ortodoncia
          grey:   '#64748b',  // 1ª Visita
          yellow: '#f59e0b',  // Urgencia
          purple: '#8b5cf6',  // Prótesis
        },

        'border-strong': '#cbd5e1',
      },
      boxShadow: {
        premium:       '0 2px 4px 0 rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.02)',
        'premium-hover':'0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)',
        glass:         'inset 0 0 0 1px rgba(255,255,255,0.2), 0 4px 12px 0 rgba(0,0,0,0.05)',
      },
      borderRadius: {
        none: '0', sm: '2px', md: '4px', lg: '6px',
        xl: '8px', '2xl': '12px', '3xl': '16px', full: '9999px',
      },
    },
  },
  plugins: [],
};
