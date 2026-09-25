/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#0f0f12',
          surface: '#18181c',
          card: '#1e1e24',
          hover: '#26262e',
          border: '#2c2c36',
          borderSubtle: '#22222a',
          purple: '#8b5cf6',
          purpleHover: '#7c3aed',
          purpleLight: '#c084fc',
          purpleFaint: 'rgba(139, 92, 246, 0.12)',
          purpleBorder: 'rgba(139, 92, 246, 0.35)',
          text: '#f4f4f5',
          textMuted: '#a1a1aa',
          textFaint: '#71717a'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
