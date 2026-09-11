// Тества разбора на медалната таблица без мрежа, върху разметка като на
// Уикипедия: sup бележки, nbsp, флагови икони, ред „Totals“ и един ред,
// който не се сумира — той трябва да бъде отхвърлен, не поправен.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const src = readFileSync('scripts/fetch-wikipedia.mjs', 'utf8');
// Изваждаме функциите за разбор, без да пускаме main().
const mod = src.slice(0, src.indexOf('const probe ='));
const dir = mkdtempSync(join(tmpdir(), 'wikitest-'));
const file = join(dir, 'parse.mjs');
writeFileSync(file, mod + '\nexport { firstTable, parseMedalTable, strip };\n');
const { firstTable, parseMedalTable, strip } = await import(file);

const html = `
<div class="mw-parser-output">
<p>Some intro prose.</p>
<table class="wikitable sortable plainrowheaders jquery-tablesorter">
<tbody>
<tr><th>Rank</th><th>NOC</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>Total</th></tr>
<tr><td>1</td><td align="left"><span class="flagicon"><img alt="" src="x.png"></span>&nbsp;<a href="/wiki/Norway">Norway</a><sup id="cite_ref-1" class="reference">[a]</sup></td><td>16</td><td>8</td><td>13</td><td>37</td></tr>
<tr><td>2</td><td align="left">&nbsp;<a href="/wiki/Germany">Germany</a></td><td>12</td><td>10</td><td>5</td><td>27</td></tr>
<tr><td>3</td><td align="left">&nbsp;<a href="/wiki/China">China</a></td><td>9</td><td>4</td><td>2</td><td>15</td></tr>
<tr><td>4</td><td align="left">&nbsp;<a href="/wiki/United_States">United States</a></td><td>8</td><td>10</td><td>7</td><td>25</td></tr>
<tr><td>5</td><td align="left">&nbsp;<a href="/wiki/Sweden">Sweden</a></td><td>8</td><td>5</td><td>5</td><td>18</td></tr>
<tr><td>6</td><td align="left">&nbsp;<a href="/wiki/Broken">Brokenland</a></td><td>3</td><td>3</td><td>3</td><td>99</td></tr>
<tr class="sortbottom"><th colspan="2">Totals (29 entries)</th><td>109</td><td>109</td><td>109</td><td>327</td></tr>
</tbody></table>
<table class="wikitable"><tbody><tr><td>a second table we must not read</td></tr></tbody></table>
</div>`;

const table = firstTable(html);
assert.ok(table, 'намери wikitable');
const { rows, rejected } = parseMedalTable(table);

const names = rows.map((r) => r.country);
assert.deepEqual(names.slice(0, 5), ['Norway', 'Germany', 'China', 'United States', 'Sweden'],
  'петте държави, в реда от страницата');

assert.equal(rows[0].gold, 16, 'златото на Норвегия');
assert.equal(rows[0].total, 37, 'общото на Норвегия');
assert.equal(rows[0].pos, 1, 'позицията');

// Редът, който не се сумира, е отхвърлен.
assert.ok(!names.includes('Brokenland'), 'редът, който не се сумира, е изваден');
assert.equal(rejected.length, 1, 'точно един отхвърлен ред');
assert.equal(rejected[0].country, 'Brokenland');

// Всеки приет ред се сумира.
for (const r of rows) {
  assert.equal(r.gold + r.silver + r.bronze, r.total, `${r.country} се сумира`);
}

// Бележките и флаговете са изчистени от имената.
assert.ok(!rows[0].country.includes('['), 'без бележки в името');
assert.equal(strip('&nbsp;<a href="#">Italy</a><sup>[b]</sup>'), 'Italy', 'чисти nbsp, връзки и sup');
// От истинския пробег: „United States‡“ — бележка като обикновен текст.
assert.equal(strip('United States&#8225;'.replace('&#8225;', '\u2021')), 'United States', 'маха кръстчето');
assert.equal(strip('Germany*'), 'Germany', 'маха звездичката');

// Редът „Totals“ се сумира коректно и иначе минаваше за държава.
assert.equal(rows.length, 5, 'точно петте държави, без сборния ред');
assert.ok(!names.some((n) => /^totals?\b/i.test(n)), 'сборният ред не е взет за държава');

// И когато класът sortbottom липсва, името пак го изважда.
const noClass = html.replace('class="sortbottom"', '');
const second = parseMedalTable(firstTable(noClass));
assert.equal(second.rows.length, 5, 'и без класа сборният ред не влиза');

console.log('всички проверки минават:', rows.length, 'валидни реда,', rejected.length, 'отхвърлен');
