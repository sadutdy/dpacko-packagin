import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Placeholder domain until the owner picks one (see docs/WEBSITE_PLAN.md §8).
export default defineConfig({
  site: 'https://dpacko.in',
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
