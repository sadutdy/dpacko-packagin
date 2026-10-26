/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens backed by CSS variables (see styles/index.css).
        // Light/dark values swap on the `dark` class of <html>.
        app: {
          bg: 'var(--app-bg)',
          surface: 'var(--app-surface)',
          subtle: 'var(--app-subtle)',
          border: 'var(--app-border)',
          'border-soft': 'var(--app-border-soft)',
          text: 'var(--app-text)',
          strong: 'var(--app-strong)',
          muted: 'var(--app-muted)',
          faint: 'var(--app-faint)',
          nav: 'var(--app-nav)',
          'nav-hover': 'var(--app-nav-hover)',
          'nav-active': 'var(--app-nav-active)',
          'nav-text': 'var(--app-nav-text)',
          overlay: 'var(--app-overlay)',
          accent: 'var(--app-accent)',
          'accent-hover': 'var(--app-accent-hover)',
          'accent-active': 'var(--app-accent-active)',
          danger: 'var(--app-danger)',
          'danger-hover': 'var(--app-danger-hover)',
          'danger-text': 'var(--app-danger-text)',
        },
      },
    },
  },
  plugins: [],
};
