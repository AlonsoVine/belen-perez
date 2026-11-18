import { defineConfig } from 'vite';

export default defineConfig({
  // rutas relativas: el sitio funciona en cualquier subcarpeta (GitHub Pages lo sirve en /<repo>/)
  base: './',
});
