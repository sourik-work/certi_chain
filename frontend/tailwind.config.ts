import type { Config } from 'tailwindcss';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f9',
          100: '#e1e9f4',
          200: '#c3d3e9',
          300: '#94b3db',
          400: '#5e8ec8',
          500: '#3a6fb3',
          600: '#2b5797',
          700: '#24457b',
          800: '#1e3863',
          900: '#0b1f4b',
          950: '#071633',
        },
        azure: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Backwards compatibility alias for components referencing brand-*
        brand: {
          50: '#f0f4f9',
          100: '#e1e9f4',
          200: '#c3d3e9',
          300: '#94b3db',
          400: '#5e8ec8',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#0b1f4b',
          800: '#0a1a3e',
          900: '#0b1f4b',
          950: '#071633',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(11, 31, 75, 0.06), 0 2px 6px -1px rgba(11, 31, 75, 0.04)',
        'card-hover': '0 12px 30px -4px rgba(11, 31, 75, 0.12), 0 4px 10px -2px rgba(11, 31, 75, 0.06)',
        'floating': '0 20px 40px -8px rgba(7, 22, 51, 0.18), 0 8px 16px -4px rgba(7, 22, 51, 0.08)',
        'navy-deep': '0 25px 50px -12px rgba(4, 13, 30, 0.45)',
        'subtle': '0 1px 3px 0 rgba(11, 31, 75, 0.05)',
      },
      borderRadius: {
        '2.5xl': '18px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
} satisfies Config;
