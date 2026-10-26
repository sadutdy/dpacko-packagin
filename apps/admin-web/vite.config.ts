import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// VITE_BASE=/backoffice/ is set by the Vercel build; local dev stays at '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5175 },
});
