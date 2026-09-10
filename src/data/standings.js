import f1 from './standings/f1.json';
import f2 from './standings/f2.json';
import f3 from './standings/f3.json';
import atp from './standings/atp.json';
import wta from './standings/wta.json';

export const standings = [
  { slug: 'formula-1', data: f1 },
  { slug: 'formula-2', data: f2 },
  { slug: 'formula-3', data: f3 },
  { slug: 'atp', data: atp },
  { slug: 'wta', data: wta },
];

/** Един спорт може да има повече от една таблица (тенисът има ATP и WTA). */
export const standingsFor = (sportSlug) =>
  standings.filter((s) => s.data.sport === sportSlug);
