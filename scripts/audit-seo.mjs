#!/usr/bin/env node
/**
 * Одит на SEO и GEO върху построения сайт.
 *
 * Проверява построения HTML, а не изходния код — така хваща и това, което се
 * губи между двете. Пуска се след `npm run build`.
 *
 * SEO: заглавие, описание, каноничен адрес, едно h1, структурирани данни,
 * вътрешни връзки, съгласие между noindex и sitemap.
 * GEO (за отговарящите машини): robots.txt да назовава обхождачите им,
 * llms.txt да съществува, съдържанието да е в HTML-а без JavaScript.
 *
 * Излиза с код 1 при грешка; предупрежденията не чупят билда.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const SITE = 'https://dilyanniliev.github.io';
const BASE = '/Sportwebsite';

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page} — ${msg}`);
const warn = (page, msg) => warnings.push(`${page} — ${msg}`);

/** Всички построени страници. */
function pages(dir = DIST, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const urlOf = (file) => BASE + file.replace(/^dist/, '').replace(/index\.html$/, '');
const attr = (html, re) => html.match(re)?.[1];
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const files = pages();
if (files.length === 0) {
  console.error('Няма построени страници. Пусни `npm run build` първо.');
  process.exit(1);
}

const titles = new Map();
const descs = new Map();
const allUrls = new Set(files.map(urlOf));
const sitemapFile = path.join(DIST, 'sitemap-0.xml');
const sitemap = fs.existsSync(sitemapFile)
  ? new Set([...fs.readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].replace(SITE, '')))
  : null;

let noindexCount = 0;
let jsonLdCount = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const url = urlOf(file);

  // --- заглавие ---
  const title = attr(html, /<title>([^<]*)<\/title>/);
  if (!title) err(url, 'няма <title>');
  else {
    const clean = decode(title);
    if (clean.length > 65) warn(url, `заглавието е ${clean.length} знака (над 65 се реже в Google)`);
    if (clean.length < 12) warn(url, `заглавието е само ${clean.length} знака`);
    if (titles.has(clean)) err(url, `същото заглавие като ${titles.get(clean)}`);
    else titles.set(clean, url);
  }

  // --- описание ---
  const desc = attr(html, /<meta name="description" content="([^"]*)"/);
  if (!desc) err(url, 'няма meta description');
  else {
    const clean = decode(desc);
    if (clean.length < 50) warn(url, `описанието е ${clean.length} знака (под 50 е слабо)`);
    if (clean.length > 170) warn(url, `описанието е ${clean.length} знака (над 170 се реже)`);
    if (descs.has(clean)) err(url, `същото описание като ${descs.get(clean)}`);
    else descs.set(clean, url);
  }

  // --- каноничен адрес ---
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  if (!canonical) err(url, 'няма canonical');
  else if (canonical !== SITE + url) err(url, `canonical сочи ${canonical}, а страницата е ${SITE + url}`);

  // --- едно h1 ---
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
  if (h1s.length === 0) err(url, 'няма h1');
  else if (h1s.length > 1) err(url, `${h1s.length} броя h1 (трябва да е точно едно)`);
  else if (!h1s[0][1].replace(/<[^>]+>/g, '').trim()) err(url, 'h1 е празно');

  // --- език и социални етикети ---
  if (!/<html lang="[a-z]{2}"/.test(html)) err(url, 'няма lang на <html>');
  for (const og of ['og:title', 'og:description', 'og:url', 'og:type']) {
    if (!html.includes(`property="${og}"`)) warn(url, `липсва ${og}`);
  }

  // --- структурирани данни: това е, което отговарящите машини четат ---
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (lds.length) jsonLdCount += 1;
  for (const ld of lds) {
    try {
      const parsed = JSON.parse(ld[1]);
      const types = JSON.stringify(parsed).match(/"@type":"([^"]+)"/g) ?? [];
      if (!types.length) warn(url, 'JSON-LD без @type');
    } catch {
      err(url, 'счупен JSON-LD');
    }
  }

  // --- noindex срещу sitemap ---
  const noindex = /name="robots" content="noindex/.test(html);
  if (noindex) noindexCount += 1;
  if (sitemap) {
    if (noindex && sitemap.has(url)) err(url, 'noindex, но стои в sitemap — противоречиви сигнали');
    if (!noindex && !sitemap.has(url)) err(url, 'индексируема, но липсва от sitemap');
  }

  // --- вътрешни връзки ---
  for (const m of html.matchAll(/<a[^>]+href="([^"]+)"/g)) {
    const href = m[1];
    if (!href.startsWith(BASE + '/')) continue;
    const target = href.split('#')[0].split('?')[0];
    if (/\.(xml|txt|json|css|js|png|svg|webp|ico)$/.test(target)) continue;
    const withSlash = target.endsWith('/') ? target : target + '/';
    if (!allUrls.has(withSlash)) err(url, `счупена вътрешна връзка → ${href}`);
  }

  // --- съдържание без JavaScript ---
  const body = html.split('<body')[1] ?? '';
  const text = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
                   .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 250 && !noindex) {
    warn(url, `само ${text.length} знака текст в HTML-а без скриптове`);
  }
}

// --- достижимост: не „има ли входяща връзка“, а „стига ли се от началото“ ---
//
// Проверката за входящи връзки пропуска затворен остров: раздел, чиито
// страници сочат само една към друга. Точно това се случи с олимпийските
// страници — всяка имаше връзка, но нямаше път дотам от началната.
const linksFrom = new Map();
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const m of html.matchAll(/<a[^>]+href="(\/Sportwebsite\/[^"#?]*)"/g)) {
    out.add(m[1].endsWith('/') ? m[1] : m[1] + '/');
  }
  linksFrom.set(urlOf(file), out);
}
const reached = new Set([BASE + '/']);
const queue = [BASE + '/'];
while (queue.length) {
  for (const next of linksFrom.get(queue.shift()) ?? []) {
    if (!reached.has(next) && linksFrom.has(next)) {
      reached.add(next);
      queue.push(next);
    }
  }
}
for (const file of files) {
  const u = urlOf(file);
  if (reached.has(u)) continue;
  const noindex = /name="robots" content="noindex/.test(fs.readFileSync(file, 'utf8'));
  if (!noindex) err(u, 'не се стига от началната страница по никакъв път от връзки');
}

// --- GEO: llms.txt трябва да покрива всеки вид страница ---
const llmsFile = path.join(DIST, 'llms.txt');
if (fs.existsSync(llmsFile)) {
  const l = fs.readFileSync(llmsFile, 'utf8');
  const kinds = ['archives/', 'standings/', 'news/', 'lineups/', 'olympics/'];
  for (const k of kinds) {
    if (!l.includes(k)) warn('llms.txt', `не изброява нито една страница от вид „${k}“`);
  }
}

// --- GEO: файловете, по които се водят отговарящите машини ---
const robots = path.join(DIST, 'robots.txt');
if (!fs.existsSync(robots)) err('robots.txt', 'липсва');
else {
  const r = fs.readFileSync(robots, 'utf8');
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    if (!r.includes(bot)) warn('robots.txt', `не назовава ${bot}`);
  }
  if (!/Sitemap:/i.test(r)) err('robots.txt', 'не сочи sitemap');
}

if (!fs.existsSync(llmsFile)) warn('llms.txt', 'липсва — отговарящите машини нямат карта на сайта');
else if (fs.readFileSync(llmsFile, 'utf8').length < 200) warn('llms.txt', 'е много кратък');

// --- отчет ---
console.log(`\nПроверени ${files.length} страници.`);
console.log(`  индексируеми: ${files.length - noindexCount} · noindex: ${noindexCount}`);
console.log(`  със структурирани данни: ${jsonLdCount}`);
console.log(`  различни заглавия: ${titles.size} · различни описания: ${descs.size}`);

if (warnings.length) {
  console.log(`\nПредупреждения (${warnings.length}):`);
  warnings.forEach((w) => console.log('  ! ' + w));
}
if (errors.length) {
  console.log(`\nГрешки (${errors.length}):`);
  errors.forEach((e) => console.log('  ✗ ' + e));
  console.log('');
  process.exit(1);
}
console.log('\nНяма грешки.\n');
