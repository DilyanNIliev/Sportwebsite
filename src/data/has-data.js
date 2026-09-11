// Кои спортове имат собствени данни — архив или класиране.
//
// Това условие се ползва на две места: страницата със статистики решава дали
// да носи noindex, а sitemap-ът решава дали да я включи. Двете трябва да
// съвпадат винаги, иначе сайтът праща противоположни сигнали на Google.
// Затова живее тук, а не преписано в astro.config.mjs — списъкът вече веднъж
// изостана, когато зимните спортове получиха медална таблица.
import { archivesFor } from './archives.js';
import { standingsFor } from './standings.js';

export const sportHasData = (slug) =>
  archivesFor(slug).length > 0 || standingsFor(slug).length > 0;
