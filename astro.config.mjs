import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// За GitHub Pages визуализация. При преминаване към собствен домейн:
// site: 'https://твоят-домейн.com', base: '/'
export default defineConfig({
  site: 'https://dilyanniliev.github.io',
  base: '/Sportwebsite',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
});
