import { defineConfig } from 'vite';

export default defineConfig({
  base: '/artemis-simulator/',
  server: {
    allowedHosts: ['jarvis.lan'],
  },
});
