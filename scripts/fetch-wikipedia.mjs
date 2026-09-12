#!/usr/bin/env node
/**
 * Тегли олимпийски таблици от Уикипедия и ги записва като JSON.
 *
 * Защо така: от средата, в която Клод работи, всички външни адреси са
 * блокирани (проверени единайсет, включително uefa.com, Уикипедия и
 * Wikidata — всички връщат 403 от прокси-то). Машината на GitHub, която
 * прави билда, няма това ограничение. Затова тегленето е отделна стъпка,
 * която върви там, а сайтът се билдва от вече записания JSON.
 *
 * Важно: билдът НЕ зависи от мрежата. Този скрипт се пуска отделно и
 * резултатът се комитва. Ако Уикипедия е недостъпна, сайтът пак се билдва.
 *
 * Лиценз: текстът на Уикипедия е CC BY-SA 4.0. Самите факти (кой е спечелил
 * кой медал) не са обект на авторско право, но таблиците се взимат наедро,
 * затова всяка страница, която ги ползва, посочва източника. Wikidata е CC0
 * и не иска дори това.
 *
 * Пускане:  node scripts/fetch-wikipedia.mjs            (всичко)
 *           node scripts/fetch-wikipedia.mjs --probe     (само проверка)
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'GlobalSportsArchive/1.0 (static sports site; contact via site)';
const OUT_DIR = 'src/data/wikipedia';

/** Игрите, които искаме, и от коя страница идва медалната таблица. */
const GAMES = [
  { id: 'winter-2010', label: 'Vancouver 2010', page: '2010 Winter Olympics medal table' },
  { id: 'winter-2014', label: 'Sochi 2014', page: '2014 Winter Olympics medal table' },
  { id: 'winter-2018', label: 'Pyeongchang 2018', page: '2018 Winter Olympics medal table' },
  { id: 'winter-2022', label: 'Beijing 2022', page: '2022 Winter Olympics medal table' },
  { id: 'winter-2026', label: 'Milano-Cortina 2026', page: '2026 Winter Olympics medal table' },
  { id: 'summer-2008', label: 'Beijing 2008', page: '2008 Summer Olympics medal table' },
  { id: 'summer-2012', label: 'London 2012', page: '2012 Summer Olympics medal table' },
  { id: 'summer-2016', label: 'Rio 2016', page: '2016 Summer Olympics medal table' },
  { id: 'summer-2020', label: 'Tokyo 2020', page: '2020 Summer Olympics medal table' },
  { id: 'summer-2024', label: 'Paris 2024', page: '2024 Summer Olympics medal table' },
];

/** Страниците „всеки медал по дисциплини“ — по една на Игри. */
const MEDALLIST_PAGES = [
  { id: 'winter-2010', label: 'Vancouver 2010', page: 'List of 2010 Winter Olympics medal winners', expect: [78, 94] },
  { id: 'winter-2014', label: 'Sochi 2014', page: 'List of 2014 Winter Olympics medal winners', expect: [90, 106] },
  { id: 'winter-2018', label: 'Pyeongchang 2018', page: 'List of 2018 Winter Olympics medal winners', expect: [94, 110] },
  { id: 'winter-2022', label: 'Beijing 2022', page: 'List of 2022 Winter Olympics medal winners', expect: [101, 117] },
  { id: 'summer-2008', label: 'Beijing 2008', page: 'List of 2008 Summer Olympics medal winners', expect: [294, 310] },
  { id: 'summer-2012', label: 'London 2012', page: 'List of 2012 Summer Olympics medal winners', expect: [294, 310] },
  { id: 'summer-2016', label: 'Rio 2016', page: 'List of 2016 Summer Olympics medal winners', expect: [298, 314] },
  { id: 'summer-2020', label: 'Tokyo 2020', page: 'List of 2020 Summer Olympics medal winners', expect: [331, 347] },
  { id: 'summer-2024', label: 'Paris 2024', page: 'List of 2024 Summer Olympics medal winners', expect: [321, 337] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Заявка към API-то, с изчакване при 429.
 *
 * Първият истински пробег падна точно тук: двайсет заявки за осем секунди и
 * Уикипедия отряза всичките. Затова между заявките има секунда и половина, а
 * при 429 се чака нарастващо и се пробва пак.
 */
async function api(params, attempt = 1) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });

  if (res.status === 429 && attempt <= 4) {
    const wait = Number(res.headers.get('retry-after')) * 1000 || attempt * 5000;
    console.log(`  429 — чакам ${wait / 1000}s и пробвам пак (опит ${attempt} от 4)`);
    await sleep(wait);
    return api(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} за ${params.page ?? params.titles}`);
  const json = await res.json();
  if (json.error) throw new Error(`API: ${json.error.code} — ${json.error.info}`);
  return json;
}

/** Готовият HTML на страницата — по-стабилен за разбор от суровия wikitext. */
async function pageHtml(title) {
  const json = await api({ action: 'parse', page: title, prop: 'text', redirects: '1' });
  return json.parse.text;
}

const strip = (html) =>
  html
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#160;/g, ' ')
    .replace(/\[\d+\]/g, '')
    // Подстригването е ПРЕДИ закотвените замени. Иначе нов ред след текста
    // разваля котвата „$“ и „Downhilldetails“ остава — точно това се случи.
    .trim()
    // „United States‡“ — бележките не са винаги в <sup>, някои са текст.
    .replace(/[*†‡§¶]+$/, '')
    // Клетката с дисциплината носи връзка „details“, слепена за името.
    .replace(/details$/i, '')
    .trim();

/**
 * Всяка „wikitable“ на страницата, с мястото ѝ в текста.
 *
 * Не с „<table…>[\s\S]*?</table>“: този израз спира на ПЪРВОТО затваряне, а
 * вътре в клетка може да има друга таблица — тогава външната се реже наполовина
 * и редовете след вложената изчезват. Затова се брои дълбочина.
 */
function* tablesIn(html) {
  const open = /<table\b[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    if (!/class="[^"]*wikitable/i.test(m[0])) continue;
    const start = m.index;
    const tag = /<\/?table\b[^>]*>/gi;
    tag.lastIndex = open.lastIndex;
    let depth = 1;
    let end = html.length;
    let t;
    while (depth > 0 && (t = tag.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      end = tag.lastIndex;
    }
    yield { at: start, html: html.slice(start, end) };
    open.lastIndex = end;
  }
}

/**
 * Вложените таблици се махат, за да не се четат техните редове като наши.
 * Търси се всяка „<table“, не само „wikitable“ — вложената рядко е такава.
 */
function withoutNested(inner) {
  let out = '';
  let i = 0;
  const open = /<table\b[^>]*>/gi;
  let m;
  while ((m = open.exec(inner))) {
    out += inner.slice(i, m.index);
    const tag = /<\/?table\b[^>]*>/gi;
    tag.lastIndex = open.lastIndex;
    let depth = 1;
    let end = inner.length;
    let t;
    while (depth > 0 && (t = tag.exec(inner))) {
      depth += t[0][1] === '/' ? -1 : 1;
      end = tag.lastIndex;
    }
    i = end;
    open.lastIndex = end;
  }
  return out + inner.slice(i);
}

/**
 * Таблицата като правоъгълна решетка, с разгънати rowspan и colspan.
 *
 * Уикипедия слива клетки често: един ранг за две държави, една дисциплина за
 * два реда. Без разгъване следващият ред идва с по-малко клетки и правилото
 * „ред с друг брой клетки не е ред“ го изхвърля — това е начинът, по който се
 * губят цели дисциплини, без нищо да изглежда счупено.
 */
function gridRows(tableHtml) {
  const inner = withoutNested(
    tableHtml.replace(/^<table\b[^>]*>/i, '').replace(/<\/table>\s*$/i, '')
  );
  const out = [];
  const pending = new Map(); // колона → {text, left} от rowspan отгоре

  for (const tr of inner.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    // Сборният ред долу („Totals“) се сумира коректно и иначе минава за държава.
    if (/class="[^"]*sortbottom/.test(tr[0])) continue;
    const row = [];
    let col = 0;
    let real = 0;    // клетки, написани в ТОЗИ ред
    let carried = 0; // клетки, дошли отгоре чрез rowspan
    let widest = 0;  // най-широкият colspan в реда
    const fill = () => {
      while (pending.has(col)) {
        const p = pending.get(col);
        row[col] = p.text;
        if (--p.left <= 0) pending.delete(col);
        carried += 1;
        col += 1;
      }
    };
    for (const c of tr[0].matchAll(/<t([hd])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      fill();
      real += 1;
      const text = strip(c[3]);
      const span = (name) => Number(new RegExp(name + '="?(\\d+)', 'i').exec(c[2])?.[1] ?? 1);
      const cols = Math.min(span('colspan'), 20);
      const rows = Math.min(span('rowspan'), 60);
      widest = Math.max(widest, cols);
      for (let k = 0; k < cols; k += 1) {
        if (rows > 1) pending.set(col, { text, left: rows - 1 });
        row[col] = text;
        col += 1;
      }
    }
    fill();
    if (row.length) {
      const cells = [...row].map((c) => c ?? '');
      // Ред от една клетка, разпъната по цялата ширина, е заглавие ВЪТРЕ в
      // таблицата („Men“, после редовете, после „Women“). След разгъването
      // изглежда като най-обикновен ред и трябва нещо да го отличи.
      //
      // Едната клетка не стига: при споделен медал вторият ред също е с една
      // написана клетка, но останалите му са пренесени отгоре. Затова тук
      // важи само ред, в който нищо не е пренесено и клетката е разпъната.
      cells.isBanner = real === 1 && carried === 0 && widest > 1;
      out.push(cells);
    }
  }
  return out;
}

/** Първата „wikitable“ на страницата, като масив от масиви. */
function firstTable(html) {
  for (const t of tablesIn(html)) return gridRows(t.html).filter((r) => r.length > 0);
  return null;
}

/**
 * Медалната таблица в редове {pos, country, gold, silver, bronze, total}.
 * Всеки ред се проверява: злато + сребро + бронз трябва да дава общото.
 * Ред, който не се сумира, не влиза — по-добре по-къса таблица.
 */
function parseMedalTable(rows) {
  const out = [];
  const rejected = [];
  for (const r of rows) {
    const nums = r.filter((c) => /^\d+$/.test(c)).map(Number);
    // Втора защита, ако класът липсва: редове като „Totals (29 entries)“.
    const country = r.find(
      (c) => /[A-Za-z]{3,}/.test(c) && !/^(Rank|NOC|Gold|Silver|Bronze)$/i.test(c) && !/^totals?\b/i.test(c)
    );
    if (!country || nums.length < 4) continue;
    // Последните четири числа са злато, сребро, бронз, общо.
    const [gold, silver, bronze, total] = nums.slice(-4);
    const posNums = nums.slice(0, -4);
    const row = { pos: posNums.length ? posNums[0] : null, country, gold, silver, bronze, total };
    if (gold + silver + bronze === total) out.push(row);
    else rejected.push(row);
  }
  return { rows: out, rejected };
}

/**
 * Дисциплините и тримата медалисти, заедно със спорта от заглавието отгоре.
 *
 * Страницата е поредица от заглавие на спорт и таблица под него, затова HTML-ът
 * се обхожда по ред и всяка таблица наследява последното заглавие.
 */
/**
 * Раздели, които имат колони Gold/Silver/Bronze, но не изброяват дисциплини.
 * „Medal leaders“ вкара двайсет реда в таблицата за Ванкувър, преди да влезе
 * тук — това са най-успешните спортисти, не състезания.
 */
const SKIP_SECTION = /^(see also|references|notes|sources|external links|contents|medal table|medal tables|medal leaders|multiple medalists|multiple medallists|statistics|records|podium sweeps|notes and references)$/i;

/**
 * Подзаглавия, които не носят смисъл като категория. „Men's events“ носи —
 * без него мъжките и женските 100 метра стават един ред — но „Medalists“ не.
 */
const GENERIC_SUB = /^(medalists|medallists|events|list of medalists)$/i;

/**
 * Втори носител на един и същи медал се долепя, вместо да става втора
 * дисциплина. Повторение на същото име не се записва два пъти.
 */
function addMedallist(rec, key, value) {
  const v = (value ?? '').trim();
  if (!v) return;
  const parts = rec[key] ? rec[key].split(' · ') : [];
  if (!parts.includes(v)) rec[key] = [...parts, v].join(' · ');
}

function parseMedallists(html) {
  const events = [];
  const skipped = [];
  /** Таблици с редове, които не бяха прочетени — с какво заглавие стояха. */
  const rejectedTables = [];

  // Заглавията се четат до h4. Спортът е винаги h2; всичко по-долу е признак,
  // който отличава дисциплините една от друга. Лондон 2012 и Токио 2020 паднаха
  // точно тук: „Keirin“ се появи два пъти, защото мъжете и жените стоят под h4
  // вътре в h3 „Track cycling“, а h4 изобщо не се четеше.
  const heads = { 2: null, 3: null, 4: null };
  let skipLevel = null;

  const marks = [];
  for (const m of html.matchAll(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/g)) {
    marks.push({ at: m.index, level: Number(m[1]), name: strip(m[2]).replace(/\[edit\]$/i, '').trim() });
  }
  for (const t of tablesIn(html)) marks.push({ at: t.at, table: t.html });
  marks.sort((a, b) => a.at - b.at);

  const context = () => {
    const sport = heads[2];
    const subs = [heads[3], heads[4]].filter((x) => x && !GENERIC_SUB.test(x));
    return { sport, category: subs.length ? subs.join(' · ') : null };
  };

  for (const mark of marks) {
    if (mark.table === undefined) {
      // Излизане от прескочен раздел: заглавие на същото или по-горно ниво.
      if (skipLevel !== null && mark.level <= skipLevel) skipLevel = null;
      for (let l = mark.level; l <= 4; l += 1) heads[l] = null;
      heads[mark.level] = mark.name;
      // Всеки спорт на страницата за Париж има свой подраздел „Medal table“ с
      // ДЪРЖАВИ — има медални колони и се четеше като дисциплини.
      if (skipLevel === null && SKIP_SECTION.test(mark.name)) skipLevel = mark.level;
      continue;
    }
    const { sport, category } = context();
    if (!sport || skipLevel !== null) continue;

    const rows = gridRows(mark.table);
    if (rows.length < 2) continue;

    const head = rows[0].map((h) => h.toLowerCase());
    const gi = head.findIndex((h) => h.startsWith('gold'));
    const si = head.findIndex((h) => h.startsWith('silver'));
    const bi = head.findIndex((h) => h.startsWith('bronze'));
    // Без трите медални колони това не е таблица с медалисти.
    if (gi < 0 || si < 0 || bi < 0) {
      rejectedTables.push({ sport, category, rows: rows.length - 1, head: rows[0].slice(0, 6) });
      continue;
    }
    const ei = head.findIndex((h) => h.startsWith('event')) >= 0 ? head.findIndex((h) => h.startsWith('event')) : 0;

    // Една дисциплина може да заема няколко реда: боксът раздава два бронза,
    // а при равенство златото е на двама. Клетката с дисциплината тогава е
    // слята надолу, тоест след разгъването съседните редове носят едно и също
    // име — и това е знакът, че са една дисциплина, а не две.
    let prev = null;
    let banner = null;
    for (const r of rows.slice(1)) {
      // Париж 2024 слага мъжете и жените в ЕДНА таблица, разделени с ред от
      // една клетка по цялата ширина. Без него „C-2 500 metres“ излиза два
      // пъти без нищо, което да ги различи.
      if (r.isBanner && r[0]) { banner = r[0]; prev = null; continue; }
      // Ред с друг брой клетки не е ред от тази таблица. Точно такъв ред
      // сложи борец на мястото на дисциплина в Лондон 2012.
      if (r.length !== rows[0].length) { skipped.push({ sport, why: 'друг брой клетки', row: r.slice(0, 2) }); continue; }
      const event = r[ei];
      const gold = r[gi];
      if (!event || !gold) { skipped.push({ sport, why: 'липсва дисциплина или злато', row: r.slice(0, 2) }); continue; }

      if (prev && prev.event === event) {
        addMedallist(prev, 'gold', gold);
        addMedallist(prev, 'silver', r[si]);
        addMedallist(prev, 'bronze', r[bi]);
        continue;
      }
      const full = [category, banner].filter(Boolean).join(' · ');
      prev = { sport, ...(full ? { category: full } : {}), event, gold, silver: r[si] ?? '', bronze: r[bi] ?? '' };
      events.push(prev);
    }
  }
  return { events, skipped, rejectedTables };
}

/**
 * Какво да се напише в лога, когато страница не мине проверките.
 *
 * Четирите летни Игри паднаха на четири различни неща и всеки път губех по
 * един пробег в гадаене на структурата. Затова тук се печата всичко, което
 * различава „разборът сгреши“ от „страницата е друга“: заглавията, колко
 * дисциплини е дал всеки спорт, и таблиците, които са били подминати.
 */
function diagnose(page, html) {
  const out = [`  заглавия на „${page}“ (първите 60):`];
  const heads = [...html.matchAll(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map((m) => `    h${m[1]} ${strip(m[2]).replace(/\[edit\]$/i, '').trim()}`)
    .slice(0, 60);
  out.push(heads.join('\n'));

  const { events, skipped, rejectedTables } = parseMedallists(html);
  const perSport = new Map();
  for (const e of events) perSport.set(e.sport, (perSport.get(e.sport) ?? 0) + 1);
  out.push('  дисциплини по спорт: ' +
    [...perSport].map(([s, n]) => `${s} ${n}`).join(', '));

  if (rejectedTables.length) {
    out.push(`  подминати таблици (${rejectedTables.length}) — без трите медални колони:`);
    for (const t of rejectedTables.slice(0, 12)) {
      out.push(`    ${t.sport}${t.category ? ' · ' + t.category : ''}: ${t.rows} реда, колони [${t.head.join(' | ')}]`);
    }
  }
  if (skipped.length) {
    out.push(`  пропуснати редове (${skipped.length}):`);
    for (const r of skipped.slice(0, 10)) out.push(`    ${r.sport}: ${r.why} — ${r.row.join(' | ')}`);
  }

  const keys = events.map((e) => `${e.sport}|${e.category ?? ''}|${e.event}`);
  const dupe = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dupe) {
    out.push('  повтореният запис, и двата пъти:');
    events.filter((e, i) => keys[i] === dupe).forEach((e) => {
      out.push(`    ${e.sport} · ${e.category ?? '—'} · ${e.event} → ${e.gold} / ${e.silver} / ${e.bronze}`);
    });
    // Съседите показват структурата: списък мъже, после списък жени в същата
    // таблица изглежда съвсем различно от две наистина различни дисциплини.
    const sportOfDupe = dupe.split('|')[0];
    out.push(`  целият „${sportOfDupe}“ по ред (до 40):`);
    events.filter((e) => e.sport === sportOfDupe).slice(0, 40).forEach((e) => {
      out.push(`    ${e.category ?? '—'} · ${e.event}`);
    });
  }
  return out.join('\n');
}

const probe = process.argv.includes('--probe');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let okCount = 0;
  const report = [];

  for (const g of GAMES) {
    try {
      const html = await pageHtml(g.page);
      const table = firstTable(html);
      if (!table) throw new Error('няма wikitable на страницата');
      const { rows, rejected } = parseMedalTable(table);
      if (rows.length < 5) throw new Error(`само ${rows.length} валидни реда`);

      report.push(`${g.label.padEnd(22)} ${String(rows.length).padStart(3)} реда, ` +
        `${String(rejected.length).padStart(2)} отхвърлени · води ${rows[0].country} (${rows[0].gold} злата)`);
      okCount += 1;

      if (!probe) {
        const file = path.join(OUT_DIR, `${g.id}.json`);
        fs.writeFileSync(file, JSON.stringify({
          games: g.label,
          source: `https://en.wikipedia.org/wiki/${encodeURIComponent(g.page.replace(/ /g, '_'))}`,
          sourceName: 'Wikipedia',
          licence: 'CC BY-SA 4.0',
          fetched: new Date().toISOString().slice(0, 10),
          rejectedRows: rejected.length,
          rows,
        }, null, 2) + '\n');
      }
    } catch (err) {
      report.push(`${g.label.padEnd(22)} ГРЕШКА: ${err.message}`);
    }
    // Кротко към чужд сървър — 400 ms не беше достатъчно.
    await sleep(1500);
  }

  console.log('\n=== Медални таблици ===\n' + report.join('\n'));
  console.log(`${okCount} от ${GAMES.length} игри.`);

  // Втори проход: медалистите по дисциплини.
  const report2 = [];
  let ok2 = 0;
  for (const g of MEDALLIST_PAGES) {
    // Страницата се тегли ВЕДНЪЖ. Вторият опит в пътя на грешката пращаше по
    // две заявки на игра и Уикипедия отвръщаше с 429 по средата на пробега.
    let html = null;
    try {
      html = await pageHtml(g.page);
      const { events, skipped } = parseMedallists(html);
      const [lo, hi] = g.expect;
      if (events.length < lo || events.length > hi) {
        throw new Error(`${events.length} дисциплини, а се очакваха между ${lo} и ${hi}`);
      }
      const sports = new Set(events.map((e) => e.sport));
      // Париж върна 330 дисциплини в едва 17 „спорта“ — броят дисциплини сам
      // по себе си не хваща сгрешено отнасяне, затова и спортовете се броят.
      const minSports = g.id.startsWith('summer') ? 28 : 10;
      if (sports.size < minSports) {
        throw new Error(`само ${sports.size} спорта, а се очакваха поне ${minSports} — разборът е сгрешил заглавията`);
      }
      // Две еднакви дисциплини в един спорт значи изгубен различаващ признак
      // (обикновено полът). По-добре да падне, отколкото да се слеят.
      const keys = events.map((e) => `${e.sport}|${e.category ?? ''}|${e.event}`);
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      if (dupes.length) {
        throw new Error(`${dupes.length} повторени дисциплини, първата „${dupes[0]}“ — липсва различаващ признак`);
      }
      report2.push(`${g.label.padEnd(22)} ${String(events.length).padStart(4)} дисциплини, ` +
        `${String(sports.size).padStart(2)} спорта, ${skipped.length} пропуснати реда`);
      ok2 += 1;

      if (!probe) {
        fs.writeFileSync(path.join(OUT_DIR, `medallists-${g.id}.json`), JSON.stringify({
          games: g.label,
          source: `https://en.wikipedia.org/wiki/${encodeURIComponent(g.page.replace(/ /g, '_'))}`,
          sourceName: 'Wikipedia',
          licence: 'CC BY-SA 4.0',
          fetched: new Date().toISOString().slice(0, 10),
          eventCount: events.length,
          sportCount: sports.size,
          skippedRows: skipped.length,
          events,
        }, null, 2) + '\n');
      }
    } catch (err) {
      report2.push(`${g.label.padEnd(22)} ГРЕШКА: ${err.message}`);
      // Структурата на страницата не се гадае — принтира се.
      if (html) report2.push(diagnose(g.page, html));
    }
    await sleep(1500);
  }

  const summary = '=== Медални таблици ===\n' + report.join('\n') +
    '\n\n=== Медалисти по дисциплини ===\n' + report2.join('\n');
  fs.writeFileSync('fetch-report.txt', summary + '\n');
  console.log('\n=== Медалисти по дисциплини ===\n' + report2.join('\n'));
  console.log(`\n${okCount + ok2} от ${GAMES.length + MEDALLIST_PAGES.length} страници успешно.` +
    (probe ? ' (проверка — нищо не е записано)' : ''));
  if (okCount === 0 && ok2 === 0) process.exit(1);
}

main().catch((e) => { console.error('Скриптът се провали:', e.message); process.exit(1); });
