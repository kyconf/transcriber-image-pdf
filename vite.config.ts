import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: "build", // ✅ Ensures output is in "build/"
    emptyOutDir: true, // ✅ Clears old builds before new ones
  },
  base: './',
});
