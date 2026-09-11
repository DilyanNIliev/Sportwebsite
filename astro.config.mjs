import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Само спортовете със собствени данни се индексират; останалите носят
// noindex (виж statistics/[sport].astro) и не бива да стоят в sitemap-а,
// защото двата сигнала си противоречат. Условието идва от същия файл, който
// ползва и страницата — преписан на ръка списък веднъж вече изостана.
import { sportHasData } from './src/data/has-data.js';

// За GitHub Pages визуализация. При преминаване към собствен домейн:
// site: 'https://твоят-домейн.com', base: '/'
export default defineConfig({
  site: 'https://dilyanniliev.github.io',
  base: '/Sportwebsite',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      filter: (page) => {
        const m = page.match(/\/statistics\/([^/]+)\/$/);
        return !m || sportHasData(m[1]);
      },
    }),
  ],
});
