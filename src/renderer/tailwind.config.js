/** @type {import('tailwindcss').Config} */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper: create a Tailwind color value from a CSS variable with alpha support.
// CSS var holds RGB triplet like "10 10 10", enabling bg-color/50 opacity syntax.
const tc = (name) => `rgb(var(--dax-${name}) / <alpha-value>)`;

export default {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware colors — all resolve to CSS custom properties set by ThemeProvider
        'dax-bg': tc('bg'),
        'dax-sidebar': tc('sidebar'),
        'dax-nav': tc('nav'),
        'dax-titlebar': tc('titlebar'),
        'dax-card': tc('card'),
        'dax-card-hover': tc('card-hover'),
        'dax-card-border': tc('card-border'),
        'dax-panel': tc('panel'),
        'dax-panel-border': tc('panel-border'),
        'dax-statusbar': tc('statusbar'),
        'dax-input': tc('input'),
        'dax-input-border': tc('input-border'),
        'dax-input-focus': tc('input-focus'),
        'dax-list-hover': tc('list-hover'),
        'dax-list-active': tc('list-active'),
        'dax-text': tc('text'),
        'dax-text-dim': tc('text-dim'),
        'dax-text-bright': tc('text-bright'),
        'dax-accent': tc('accent'),
        'dax-accent-hover': tc('accent-hover'),
        'dax-error': tc('error'),
        'dax-warning': tc('warning'),
        'dax-success': tc('success'),
        'dax-info': tc('info'),
        'dax-scrollbar': tc('scrollbar'),
        'dax-scrollbar-hover': tc('scrollbar-hover'),
        'dax-badge': tc('badge'),
        'dax-badge-fg': tc('badge-fg'),
        'dax-button': tc('button'),
        'dax-button-hover': tc('button-hover'),
        'dax-button-secondary': tc('button-secondary'),
        'dax-button-secondary-hover': tc('button-secondary-hover'),
        'dax-dropdown': tc('dropdown'),
        'dax-dropdown-border': tc('dropdown-border'),
        'dax-selection': tc('selection'),
        'dax-node-trigger': tc('node-trigger'),
        'dax-node-processor': tc('node-processor'),
        'dax-node-action': tc('node-action'),
        'dax-node-logic': tc('node-logic'),
      },
      fontFamily: {
        'ui': ['Inter', '"Segoe UI"', 'system-ui', 'sans-serif'],
        'brand': ['"Audiowide"', 'sans-serif'],
        'mono': ['Consolas', '"Courier New"', 'monospace'],
      },
      fontSize: {
        'xs': '11px',
        'sm': '12px',
        'base': '13px',
        'lg': '14px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '32px',
      },
      spacing: {
        'sidebar': '240px',
        'statusbar': '24px',
        'titlebar': '32px',
        'nav-icon': '48px',
      },
      borderRadius: {
        'card': '12px',
        'node': '8px',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'slide-right': 'slideRight 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgb(var(--dax-accent) / 0.3)' },
          '50%': { boxShadow: '0 0 20px rgb(var(--dax-accent) / 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
