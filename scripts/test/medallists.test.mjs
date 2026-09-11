// Тества разбора на страницата „всеки медал по дисциплини“ без мрежа.
// Проверява: спортът идва от заглавието отгоре; таблица без трите медални
// колони се пропуска; „See also“ не е спорт; отборни дисциплини с много имена
// не се чупят.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const src = readFileSync('scripts/fetch-wikipedia.mjs', 'utf8');
const mod = src.slice(0, src.indexOf("const probe = process.argv"));
const dir = mkdtempSync(join(tmpdir(), 'medallists-'));
const file = join(dir, 'p.mjs');
writeFileSync(file, mod + '\nexport { parseMedallists };\n');
const { parseMedallists } = await import(file);

const html = `
<div class="mw-heading"><h2 id="Alpine_skiing">Alpine skiing</h2></div>
<table class="wikitable">
<tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td><a href="#">Men's downhill</a></td><td>Beat Feuz<br><small>Switzerland</small></td><td>Johan Clarey<sup>[1]</sup></td><td>Matthias Mayer</td></tr>
<tr><td>Women's slalom</td><td>Petra Vlhová</td><td>Katharina Liensberger</td><td>Wendy Holdener</td></tr>
</tbody></table>

<div class="mw-heading"><h2 id="Curling">Curling</h2></div>
<table class="wikitable">
<tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>Ref</th></tr>
<tr><td>Mixed doubles</td><td>Stefania Constantini<br>Amos Mosaner</td><td>Kristin Skaslien<br>Magnus Nedregotten</td><td>Almida de Val<br>Oskar Eriksson</td><td>[2]</td></tr>
</tbody></table>

<div class="mw-heading"><h2 id="Medal_table">Medal table</h2></div>
<table class="wikitable">
<tbody>
<tr><th>Rank</th><th>NOC</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>Total</th></tr>
<tr><td>1</td><td>Norway</td><td>16</td><td>8</td><td>13</td><td>37</td></tr>
</tbody></table>

<div class="mw-heading"><h2 id="See_also">See also</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Should not appear</td><td>Nobody</td><td>Nobody</td><td>Nobody</td></tr>
</tbody></table>`;

// От истинския пробег: раздел „Medal leaders“ с медални колони, който не
// изброява дисциплини, и спорт, разделен на h3 по пол.
const extra = `
<div class="mw-heading"><h2 id="Medal_leaders">Medal leaders</h2></div>
<table class="wikitable"><tbody>
<tr><th>Athlete</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Marit Bjørgen</td><td>3</td><td>1</td><td>1</td></tr>
</tbody></table>

<div class="mw-heading"><h2 id="Cycling">Cycling</h2></div>
<div class="mw-heading"><h3 id="Men's_events">Men's events</h3></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Road race</td><td>Remco Evenepoel</td><td>Valentin Madouas</td><td>Christophe Laporte</td></tr>
</tbody></table>`;

const { events, skipped } = parseMedallists(html + extra);
const sports = [...new Set(events.map((e) => e.sport))];

assert.deepEqual(sports, ['Alpine skiing', 'Curling', 'Cycling'], 'само истинските спортове');
assert.equal(events.length, 4, 'четири дисциплини');

// „Medal leaders“ има медални колони, но изброява спортисти, не състезания.
assert.ok(!events.some((e) => e.sport === 'Medal leaders'), '„Medal leaders“ не е спорт');
assert.ok(!events.some((e) => e.event === 'Marit Bjørgen'), 'спортист не е станал дисциплина');

// Дисциплината под h3 „Men's events“ носи спорта от h2 отгоре.
const road = events.find((e) => e.event === 'Road race');
assert.equal(road.sport, 'Cycling', 'спортът идва от h2, не от h3 за пола');
assert.equal(road.category, "Men's events", 'полът се пази отделно, за да не се слеят мъже и жени');

// Наставката „details“ от връзката в клетката.
const dh = events.find((e) => /downhill/i.test(e.event));
assert.equal(dh.event, "Men's downhill", 'без наставка details');

// Ред с друг брой клетки не е ред от таблицата.
const ragged = parseMedallists(`
<div class="mw-heading"><h2 id="Wrestling">Wrestling</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Men's 55 kg</td><td>A</td><td>B</td><td>C</td></tr>
<tr><td>Bilyal Makhov Russia</td><td>only two</td></tr>
</tbody></table>`);
assert.equal(ragged.events.length, 1, 'кривият ред не влиза');
assert.equal(ragged.skipped.length, 1, 'кривият ред е преброен');

assert.equal(events[0].event, "Men's downhill");
assert.ok(events[0].gold.startsWith('Beat Feuz'), 'златото с името');
assert.equal(events[0].silver, 'Johan Clarey', 'бележката [1] е махната');
assert.equal(events[0].event, "Men's downhill", 'името на дисциплината е чисто');

// Отборна дисциплина: двете имена остават, просто слепени.
assert.ok(events[2].gold.includes('Stefania Constantini'), 'първото име');
assert.ok(events[2].gold.includes('Amos Mosaner'), 'и второто');

// „Medal table“ е с колони Rank/NOC — няма колона Event, но има Gold/Silver/
// Bronze, затова я изключваме по заглавието, не по колоните.
assert.ok(!events.some((e) => e.sport === 'Medal table'), 'медалната таблица не е спорт');
assert.ok(!events.some((e) => e.event === 'Should not appear'), '„See also“ е изключено');
assert.ok(!events.some((e) => /^\d+$/.test(e.event)), 'няма ред, чието „събитие“ е число');

console.log('минава:', events.length, 'дисциплини в', sports.length, 'спорта,', skipped.length, 'пропуснати');
