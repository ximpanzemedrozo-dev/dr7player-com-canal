import { defineConfig } from 'vite';

export default defineConfig({
  // Garante que os caminhos dos arquivos gerados (JS/CSS) sejam relativos, resolvendo o erro text/html
  base: './', 
});
