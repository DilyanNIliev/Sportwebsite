import f1 from './standings/f1.json';
import f2 from './standings/f2.json';
import f3 from './standings/f3.json';

export const standings = [
  { slug: 'formula-1', data: f1 },
  { slug: 'formula-2', data: f2 },
  { slug: 'formula-3', data: f3 },
];

export const standingsFor = (sportSlug) =>
  standings.find((s) => s.data.sport === sportSlug);
