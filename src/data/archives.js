// Един списък с архивите. Всяка страница чете оттук, вместо да си държи
// собствено копие — добавянето на архив е един ред на едно място.
import worldCup from './archives/world-cup.json';
import f1 from './archives/f1-champions.json';
import boxing from './archives/boxing-lineal.json';
import basketball from './archives/basketball-world-cup.json';
import volleyball from './archives/volleyball-world-championship.json';
import f2champs from './archives/f2-champions.json';
import f3champs from './archives/f3-champions.json';

export const archives = [
  { slug: 'world-cup', data: worldCup, href: 'world-cup' },
  { slug: 'f1-champions', data: f1, href: 'f1-champions' },
  { slug: 'boxing-champions', data: boxing, href: 'boxing-champions' },
  { slug: 'basketball-world-cup', data: basketball, href: 'basketball-world-cup' },
  { slug: 'volleyball-world-championship', data: volleyball, href: 'volleyball-world-championship' },
  { slug: 'f2-champions', data: f2champs, href: 'f2-champions' },
  { slug: 'f3-champions', data: f3champs, href: 'f3-champions' },
];

/** Броят редове, независимо дали архивът е с една таблица или с няколко. */
export function rowCount(a) {
  if (a.data.rows) return a.data.rows.length;
  return (a.data.divisions ?? []).reduce((n, d) => n + d.rows.length, 0);
}

export const archivesFor = (sportSlug) =>
  archives.filter((a) => a.data.sport === sportSlug);
