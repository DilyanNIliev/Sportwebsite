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
    // „United States‡“ — истинският пробег извади това. Бележките в таблиците
    // на Уикипедия не са винаги в <sup>, някои са обикновен текст.
    .replace(/[*†‡§¶]+$/, '')
    .trim();

/** Първата „wikitable“ на страницата, като масив от масиви. */
function firstTable(html) {
  const m = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/);
  if (!m) return null;
  const rows = [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/g)]
    // Сборният ред долу („Totals“) се сумира коректно и иначе минава за
    // държава. Маха се по класа, който Уикипедия винаги му слага.
    .filter((r) => !/class="[^"]*sortbottom/.test(r[0]))
    .map((r) => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => strip(c[1])));
  return rows.filter((r) => r.length > 0);
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

const probe = process.argv.includes('--probe');

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

  console.log('\n' + report.join('\n'));
  console.log(`\n${okCount} от ${GAMES.length} игри успешно.` + (probe ? ' (проверка — нищо не е записано)' : ''));
  if (okCount === 0) process.exit(1);
}

main().catch((e) => { console.error('Скриптът се провали:', e.message); process.exit(1); });
