/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
  			display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			// Playful brand palette — used across gradients, glows & accents
  			grape: {
  				DEFAULT: '#7c5cff',
  				50: '#f1edff',
  				100: '#e4dbff',
  				200: '#cabaff',
  				300: '#ab92ff',
  				400: '#8e6bff',
  				500: '#7c5cff',
  				600: '#6438f5',
  				700: '#5328d6',
  				800: '#4422ac',
  				900: '#2f1a73',
  			},
  			bubble: {
  				DEFAULT: '#ff4d9d',
  				400: '#ff6fb0',
  				500: '#ff4d9d',
  				600: '#ec2d83',
  			},
  			aqua: {
  				DEFAULT: '#22d3ee',
  				400: '#38e0f5',
  				500: '#22d3ee',
  				600: '#0bb6d4',
  			},
  			sunny: {
  				DEFAULT: '#fbbf24',
  				400: '#fcd34d',
  				500: '#fbbf24',
  			},
  			mint: {
  				DEFAULT: '#34e0a1',
  				500: '#34e0a1',
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			xl: 'calc(var(--radius) + 4px)',
  			'2xl': 'calc(var(--radius) + 8px)',
  		},
  		boxShadow: {
  			'glow': '0 0 24px -4px rgba(124, 92, 255, 0.45)',
  			'glow-grape': '0 0 28px -6px rgba(124, 92, 255, 0.55)',
  			'glow-bubble': '0 0 28px -6px rgba(255, 77, 157, 0.55)',
  			'glow-aqua': '0 0 28px -6px rgba(34, 211, 238, 0.5)',
  			'glow-sunny': '0 0 28px -6px rgba(251, 191, 36, 0.55)',
  			'soft': '0 10px 40px -12px rgba(0, 0, 0, 0.6)',
  		},
  		backgroundImage: {
  			'grid-fade': 'linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: 0 },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: 0 }
  			},
  			'shake': {
  				'0%, 100%': { transform: 'translateX(0)' },
  				'10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
  				'20%, 40%, 60%, 80%': { transform: 'translateX(4px)' }
  			},
  			'float': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-12px)' }
  			},
  			'aurora': {
  				'0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
  				'33%': { transform: 'translate(40px, -30px) scale(1.1)' },
  				'66%': { transform: 'translate(-30px, 20px) scale(0.95)' }
  			},
  			'gradient-x': {
  				'0%, 100%': { 'background-position': '0% 50%' },
  				'50%': { 'background-position': '100% 50%' }
  			},
  			'shimmer': {
  				'100%': { transform: 'translateX(100%)' }
  			},
  			'pop': {
  				'0%': { transform: 'scale(0.85)', opacity: 0 },
  				'60%': { transform: 'scale(1.05)' },
  				'100%': { transform: 'scale(1)', opacity: 1 }
  			},
  			'fade-up': {
  				'0%': { opacity: 0, transform: 'translateY(16px)' },
  				'100%': { opacity: 1, transform: 'translateY(0)' }
  			},
  			'wiggle': {
  				'0%, 100%': { transform: 'rotate(-3deg)' },
  				'50%': { transform: 'rotate(3deg)' }
  			},
  			'spin-slow': {
  				to: { transform: 'rotate(360deg)' }
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
  			'float': 'float 6s ease-in-out infinite',
  			'aurora': 'aurora 18s ease-in-out infinite',
  			'gradient-x': 'gradient-x 6s ease infinite',
  			'shimmer': 'shimmer 2.5s infinite',
  			'pop': 'pop 0.35s cubic-bezier(.34,1.56,.64,1) both',
  			'fade-up': 'fade-up 0.5s ease-out both',
  			'wiggle': 'wiggle 0.6s ease-in-out',
  			'spin-slow': 'spin-slow 14s linear infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
