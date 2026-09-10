import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Спортовете, които вече имат собствени архиви. Само техните статистически
// страници се индексират — останалите носят noindex (виж statistics/[sport].astro)
// и не бива да стоят в sitemap-а, защото двата сигнала си противоречат.
const SPORTS_WITH_DATA = ['football', 'formula-1', 'boxing-mma', 'basketball', 'volleyball', 'formula-2', 'formula-3', 'tennis'];

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
        return !m || SPORTS_WITH_DATA.includes(m[1]);
      },
    }),
  ],
});
