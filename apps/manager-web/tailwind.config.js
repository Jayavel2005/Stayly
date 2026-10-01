/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Specific Brand palette as defined in DESIGN_SYSTEM.md
        brand: {
          50: '#f0f5fa',
          100: '#deebf5',
          200: '#c0d9ec',
          300: '#93c0de',
          400: '#5fa2cc',
          500: '#3884b5',
          600: '#256a97',
          700: '#1c5277',
          800: '#184462',
          900: '#163952',
          950: '#0f2434',
        },
        // Warm Neutral palette
        neutral: {
          50: '#faf9f6',
          100: '#f4f2ec',
          200: '#e7e4dc',
          300: '#d5d0c4',
          400: '#aba495',
          500: '#878071',
          600: '#6a6356',
          700: '#534e44',
          800: '#3f3b34',
          900: '#23211d',
          950: '#141311',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(22, 57, 82, 0.05), 0 1px 2px rgba(22, 57, 82, 0.03)',
        card: '0 2px 8px -2px rgba(22, 57, 82, 0.08), 0 1px 4px -1px rgba(22, 57, 82, 0.04)',
        elevated: '0 10px 25px -5px rgba(22, 57, 82, 0.12), 0 8px 10px -6px rgba(22, 57, 82, 0.06)',
      },
    },
  },
  plugins: [],
};
