/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        surface: '#FFFFFF',
        sidebar: {
          DEFAULT: '#101828',
          hover: '#1D2939',
          active: '#1F2430',
          border: '#1F2937'
        },
        primary: {
          DEFAULT: '#101828',
          text: '#101828',
          accent: '#635BFF',
          accentHover: '#534BEA',
          accentBg: '#EEF0FF'
        },
        secondary: {
          DEFAULT: '#667085',
          text: '#667085',
          light: '#98A2B3'
        },
        success: {
          DEFAULT: '#12B76A',
          bg: '#ECFDF3',
          border: '#A6F4C5'
        },
        warning: {
          DEFAULT: '#F79009',
          bg: '#FFFAEB',
          border: '#FEDF89'
        },
        danger: {
          DEFAULT: '#F04438',
          bg: '#FEF3F2',
          border: '#FECDCA'
        },
        info: {
          DEFAULT: '#2E90FA',
          bg: '#EFF8FF',
          border: '#B2DDFF'
        },
        neutralBorder: '#EAECF0'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'card': '0px 1px 3px rgba(16, 24, 40, 0.05), 0px 1px 2px rgba(16, 24, 40, 0.02)',
        'card-hover': '0px 4px 8px -2px rgba(16, 24, 40, 0.06), 0px 2px 4px -2px rgba(16, 24, 40, 0.04)',
        'modal': '0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)'
      },
      borderRadius: {
        'card': '14px',
      }
    },
  },
  plugins: [],
}

