
import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	safelist: [
		// Radix UI state classes
		'data-[state=open]',
		'data-[state=closed]',
		'data-[state=checked]',
		'data-[state=unchecked]',
		'data-[state=on]',
		'data-[state=off]',
		'data-[state=active]',
		'data-[state=inactive]',
		'data-[side=top]',
		'data-[side=right]',
		'data-[side=bottom]',
		'data-[side=left]',
		'data-[align=start]',
		'data-[align=center]',
		'data-[align=end]',
		// Game colors
		'bg-game-blue',
		'bg-game-red', 
		'bg-game-green',
		'bg-game-yellow',
		'bg-game-purple',
		'bg-game-orange',
		'bg-game-cyan',
		'bg-game-pink',
		'bg-game-rug',
		'text-game-blue',
		'text-game-red',
		'text-game-green',
		'text-game-yellow',
		'text-game-purple',
		'text-game-orange',
		'text-game-cyan',
		'text-game-pink',
		'text-game-rug',
		// Cyber theme colors
		'bg-cyber-cyan',
		'bg-cyber-magenta',
		'bg-cyber-green',
		'bg-cyber-yellow',
		'bg-cyber-orange',
		'bg-cyber-blue',
		'bg-cyber-purple',
		'bg-cyber-pink',
		'text-cyber-cyan',
		'text-cyber-magenta',
		'text-cyber-green',
		'text-cyber-yellow',
		'text-cyber-orange',
		'text-cyber-blue',
		'text-cyber-purple',
		'text-cyber-pink',
		'border-cyber-cyan',
		'border-cyber-magenta',
		'border-cyber-green',
		// Animation classes used in components
		'animate-pulse',
		'animate-float',
		'animate-grid-flow',
		'animate-scan-line',
		'animate-glitch',
		'animate-neon-pulse',
		'animate-terminal-blink',
		// Responsive variants for key utilities
		{
			pattern: /(bg|text|border)-(primary|secondary|accent|muted|destructive)/,
			variants: ['hover', 'focus', 'active', 'disabled']
		},
		{
			pattern: /(h|w)-(4|6|8|10|12|16|20|24|32|48|64|full|screen)/,
			variants: ['sm', 'md', 'lg', 'xl', '2xl']
		}
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
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				game: {
					'blue': '#3498db',
					'red': '#e74c3c',
					'green': '#2ecc71',
					'yellow': '#f1c40f',
					'purple': '#9b59b6',
					'orange': '#e67e22',
					'cyan': '#1abc9c',
					'pink': '#fd79a8',
					'rug': '#8e44ad'
				},
				cyber: {
					cyan: '#00ffff',
					magenta: '#ff00ff',
					green: '#00ff00',
					yellow: '#ffff00',
					orange: '#ff6600',
					blue: '#0080ff',
					purple: '#8000ff',
					pink: '#ff0080'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				pulse: {
					'0%, 100%': { transform: 'scale(1)' },
					'50%': { transform: 'scale(1.05)' },
				},
				float: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-10px)' },
				},
				'grid-flow': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'scan-line': {
					'0%': { transform: 'translateY(-100vh)' },
					'100%': { transform: 'translateY(100vh)' }
				},
				'glitch': {
					'0%': { transform: 'translate(0)' },
					'20%': { transform: 'translate(-2px, 2px)' },
					'40%': { transform: 'translate(-2px, -2px)' },
					'60%': { transform: 'translate(2px, 2px)' },
					'80%': { transform: 'translate(2px, -2px)' },
					'100%': { transform: 'translate(0)' }
				},
				'neon-pulse': {
					'0%, 100%': { 
						textShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
						opacity: '1'
					},
					'50%': { 
						textShadow: '0 0 2px currentColor, 0 0 5px currentColor, 0 0 8px currentColor',
						opacity: '0.8'
					}
				},
				'terminal-blink': {
					'0%, 50%': { opacity: '1' },
					'51%, 100%': { opacity: '0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'pulse': 'pulse 2s infinite ease-in-out',
				'float': 'float 6s infinite ease-in-out',
				'grid-flow': 'grid-flow 20s linear infinite',
				'scan-line': 'scan-line 2s linear infinite',
				'glitch': 'glitch 0.3s ease-in-out',
				'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
				'terminal-blink': 'terminal-blink 1s step-end infinite'
			},
			fontFamily: {
				'mono': ['Courier New', 'monospace'],
				'pixel': ['Press Start 2P', 'cursive']
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
