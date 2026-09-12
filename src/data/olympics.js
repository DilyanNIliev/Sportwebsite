// Игрите: медална таблица и, където я имаме, всяка дисциплина с тримата
// медалисти. Данните идват от Уикипедия през scripts/fetch-wikipedia.mjs.
//
// Домакинът и датите се пишат тук, защото не идват от изтеглените таблици.
import s2008 from './wikipedia/summer-2008.json';
import s2012 from './wikipedia/summer-2012.json';
import s2016 from './wikipedia/summer-2016.json';
import s2020 from './wikipedia/summer-2020.json';
import s2024 from './wikipedia/summer-2024.json';
import w2010 from './wikipedia/winter-2010.json';
import w2014 from './wikipedia/winter-2014.json';
import w2018 from './wikipedia/winter-2018.json';
import w2022 from './wikipedia/winter-2022.json';
import w2026 from './wikipedia/winter-2026.json';

import ms2008 from './wikipedia/medallists-summer-2008.json';
import ms2012 from './wikipedia/medallists-summer-2012.json';
import ms2016 from './wikipedia/medallists-summer-2016.json';
import ms2020 from './wikipedia/medallists-summer-2020.json';
import ms2024 from './wikipedia/medallists-summer-2024.json';
import mw2010 from './wikipedia/medallists-winter-2010.json';
import mw2014 from './wikipedia/medallists-winter-2014.json';
import mw2018 from './wikipedia/medallists-winter-2018.json';
import mw2022 from './wikipedia/medallists-winter-2022.json';

const MEDALLISTS = {
  'summer-2008': ms2008,
  'summer-2012': ms2012,
  'summer-2016': ms2016,
  'summer-2020': ms2020,
  'summer-2024': ms2024,
  'winter-2010': mw2010,
  'winter-2014': mw2014,
  'winter-2018': mw2018,
  'winter-2022': mw2022,
};

/** Домакин и период — не идват от медалната таблица. */
const HOSTS = {
  'summer-2008': { host: 'Beijing', country: 'China', dates: '8–24 August 2008' },
  'summer-2012': { host: 'London', country: 'Great Britain', dates: '27 July – 12 August 2012' },
  'summer-2016': { host: 'Rio de Janeiro', country: 'Brazil', dates: '5–21 August 2016' },
  'summer-2020': { host: 'Tokyo', country: 'Japan', dates: '23 July – 8 August 2021, held a year late' },
  'summer-2024': { host: 'Paris', country: 'France', dates: '26 July – 11 August 2024' },
  'winter-2010': { host: 'Vancouver', country: 'Canada', dates: '12–28 February 2010' },
  'winter-2014': { host: 'Sochi', country: 'Russia', dates: '7–23 February 2014' },
  'winter-2018': { host: 'Pyeongchang', country: 'South Korea', dates: '9–25 February 2018' },
  'winter-2022': { host: 'Beijing', country: 'China', dates: '4–20 February 2022' },
  'winter-2026': { host: 'Milano-Cortina', country: 'Italy', dates: '6–22 February 2026' },
};

const TABLES = {
  'summer-2008': s2008, 'summer-2012': s2012, 'summer-2016': s2016,
  'summer-2020': s2020, 'summer-2024': s2024,
  'winter-2010': w2010, 'winter-2014': w2014, 'winter-2018': w2018,
  'winter-2022': w2022, 'winter-2026': w2026,
};

export const games = Object.entries(TABLES)
  .map(([id, table]) => {
    const med = MEDALLISTS[id] ?? null;
    return {
      id,
      season: id.startsWith('winter') ? 'Winter' : 'Summer',
      year: Number(id.slice(-4)),
      label: table.games,
      ...HOSTS[id],
      table,
      // Спортът на страницата: зимните под winter-sports, летните под athletics.
      sport: id.startsWith('winter') ? 'winter-sports' : 'athletics',
      events: med?.events ?? null,
      eventCount: med?.eventCount ?? 0,
      sportCount: med?.sportCount ?? 0,
      medallistSource: med?.source ?? null,
    };
  })
  .sort((a, b) => b.year - a.year || a.season.localeCompare(b.season));

/** Дисциплините, групирани по спорт, в реда от източника. */
export function eventsBySport(g) {
  if (!g.events) return [];
  const out = [];
  for (const e of g.events) {
    const last = out[out.length - 1];
    if (last && last.sport === e.sport) last.events.push(e);
    else out.push({ sport: e.sport, events: [e] });
  }
  return out;
}

export const gamesFor = (sportSlug) => games.filter((g) => g.sport === sportSlug);
