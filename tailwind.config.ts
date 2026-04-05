import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // LOANZ 360 Brand Colors
        brand: {
          primary: "#FF6700",      // Orange
          black: "#000000",        // Pure Black - for input fields
          card: {
            DEFAULT: "#171717",    // Main card background (neutral-900)
            dark: "#262626",       // Darker card variant (neutral-800)
            border: "#404040",     // Card borders (neutral-700)
          },
          ash: "#171717",          // Ash Gray for card backgrounds (neutral-900)
          sidebar: "#2E2E2E",      // Sidebar hover background
          glass: "rgba(255, 255, 255, 0.22)", // White-tinted glassmorphism background
        },

        // Theme colors based on requirements
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Status colors for financial application
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",

        // Text colors
        text: {
          primary: "#FFFFFF",
          secondary: "#B3B3B3",
          muted: "#6B7280",
        },

        // Heading colors
        heading: {
          primary: "#FF6700",    // Orange for all main content headings
          secondary: "#FF8533",  // Lighter orange for sub-headings
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // Logo font: Droid Serif
        logo: ['Droid Serif', 'serif'],
        // UI font: Poppins (main website font)
        sans: ['var(--font-poppins)', 'Poppins', 'ui-sans-serif', 'system-ui'],
        poppins: ['var(--font-poppins)', 'Poppins', 'ui-sans-serif', 'system-ui'],
        roboto: ['Roboto', 'ui-sans-serif', 'system-ui'],
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '1.4' }], // Default 12px Poppins
        'sm': ['14px', { lineHeight: '1.4' }],
        'base': ['12px', { lineHeight: '1.4' }], // Make base also 12px
        'lg': ['18px', { lineHeight: '1.4' }],
        'xl': ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.4' }],
        '3xl': ['30px', { lineHeight: '1.4' }],
        '4xl': ['36px', { lineHeight: '1.4' }],
        'logo-lg': ['2.5rem', { lineHeight: '1.2' }],
        'logo-md': ['2rem', { lineHeight: '1.2' }],
        'logo-sm': ['1.5rem', { lineHeight: '1.2' }],
      },
      spacing: {
        'banner-height': '300px',
        'sidebar-width': '280px',
        'header-height': '64px',
      },
      screens: {
        'tablet': '768px',
        'desktop': '1200px',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'orange-glow': '0 0 20px rgba(255, 103, 0, 0.3)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(255, 255, 255, 0.1), inset 0 0 26px 13px rgba(255, 255, 255, 0.13)', // Advanced glassmorphism with inset highlights
      },
      backdropBlur: {
        'glass': '19px', // Glassmorphism blur effect
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "pulse-orange": "pulse-orange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bell-ring": "bell-ring 1s ease-in-out",
        "urgent-flash": "urgent-flash 2s ease-in-out infinite",
        "pulse-once": "pulse-once 2s ease-in-out",
        "slide-up": "slide-up 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in": {
          from: { transform: "translateY(-10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-orange": {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.7",
          },
        },
        "bell-ring": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "10%, 30%": { transform: "rotate(-15deg)" },
          "20%, 40%": { transform: "rotate(15deg)" },
          "50%": { transform: "rotate(-10deg)" },
          "60%": { transform: "rotate(10deg)" },
          "70%": { transform: "rotate(-5deg)" },
          "80%": { transform: "rotate(5deg)" },
          "90%": { transform: "rotate(0deg)" },
        },
        "urgent-flash": {
          "0%, 100%": {
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgb(239, 68, 68)",
          },
          "50%": {
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            borderColor: "rgb(220, 38, 38)",
          },
        },
        "pulse-once": {
          "0%": { boxShadow: "0 0 0 0 rgba(255, 103, 0, 0.5)" },
          "50%": { boxShadow: "0 0 0 8px rgba(255, 103, 0, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255, 103, 0, 0)" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
      },
      backgroundImage: {
        'gradient-orange': 'linear-gradient(135deg, #FF6700 0%, #FF8533 100%)',
        'gradient-dark': 'linear-gradient(135deg, #000000 0%, #1A1A1A 100%)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config