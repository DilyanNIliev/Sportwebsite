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

// От истинския лог: структурата на страницата за Париж 2024 — всеки спорт
// има свой подраздел „Medal table“ с ДЪРЖАВИ, който не са дисциплини.
const paris = `
<div class="mw-heading"><h2 id="Archery">Archery</h2></div>
<div class="mw-heading"><h3 id="Medal_table">Medal table</h3></div>
<table class="wikitable"><tbody>
<tr><th>Rank</th><th>NOC</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>1</td><td>South Korea</td><td>5</td><td>1</td><td>1</td></tr>
</tbody></table>
<div class="mw-heading"><h3 id="Medalists">Medalists</h3></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td><a>Men's individual</a><a>details</a>
</td><td>Kim Woo-jin</td><td>Brady Ellison</td><td>Lee Woo-seok</td></tr>
</tbody></table>`;

const { events, skipped } = parseMedallists(html + extra + paris);
const sports = [...new Set(events.map((e) => e.sport))];

assert.deepEqual(sports, ['Alpine skiing', 'Curling', 'Cycling', 'Archery'], 'само истинските спортове');
assert.equal(events.length, 5, 'пет дисциплини');

// Подразделът „Medal table“ на един спорт изброява държави, не състезания.
assert.ok(!events.some((e) => e.event === 'South Korea'), 'държава не е станала дисциплина');
assert.ok(!events.some((e) => e.category === 'Medal table'), 'няма нищо от „Medal table“');

// „Medalists“ е общо подзаглавие — не бива да става категория.
const arch = events.find((e) => e.sport === 'Archery');
assert.equal(arch.category, undefined, '„Medalists“ не е категория');
// И нов ред след „details“ не бива да оставя наставката.
assert.equal(arch.event, "Men's individual", 'details е махнато въпреки новия ред');

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

// --- трите случая, заради които парсерът беше пипнат ---

// 1. Лондон 2012 и Токио 2020: полът стои под h4 вътре в h3 с дисциплината.
//    С четене само до h3 „Keirin“ се появяваше два пъти и страницата падаше
//    на проверката за повторени дисциплини.
const nested = parseMedallists(`
<div class="mw-heading"><h2 id="Cycling">Cycling</h2></div>
<div class="mw-heading"><h3 id="Track">Track cycling</h3></div>
<div class="mw-heading"><h4 id="Men">Men's events</h4></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Keirin</td><td>Chris Hoy</td><td>Maximilian Levy</td><td>Simon van Velthooven</td></tr>
</tbody></table>
<div class="mw-heading"><h4 id="Women">Women's events</h4></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Keirin</td><td>Victoria Pendleton</td><td>Guo Shuang</td><td>Lee Wai-sze</td></tr>
</tbody></table>`);
assert.equal(nested.events.length, 2, 'двете кейрин-състезания са два реда');
assert.equal(nested.events[0].sport, 'Cycling', 'спортът пак е h2');
assert.equal(nested.events[0].category, "Track cycling · Men's events", 'веригата от подзаглавия');
assert.notEqual(nested.events[0].category, nested.events[1].category, 'мъжете и жените се различават');

// 2. Слети клетки в съседна колона. Класът на лодката стои веднъж за два
//    реда: вторият ред идва с една клетка по-малко и правилото „ред с друг
//    брой клетки не е ред“ го изхвърляше. Така се губят цели дисциплини, без
//    нищо да изглежда счупено — Рио върна 225 от 306, Париж 221 от 329.
const spans = parseMedallists(`
<div class="mw-heading"><h2 id="Canoeing">Canoeing</h2></div>
<table class="wikitable"><tbody>
<tr><th>Class</th><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td rowspan="2">Sprint</td><td>K-1 200 metres</td><td>Liam Heath</td><td>Maxime Beaumont</td><td>Saúl Craviotto</td></tr>
<tr><td>K-1 1000 metres</td><td>Marcus Walz</td><td>Josef Dostál</td><td>Roland Varga</td></tr>
</tbody></table>`);
assert.equal(spans.events.length, 2, 'и вторият ред се чете');
assert.equal(spans.skipped.length, 0, 'нищо не е изхвърлено като криво');
assert.equal(spans.events[1].event, 'K-1 1000 metres', 'дисциплината е от своята колона');
assert.equal(spans.events[1].gold, 'Marcus Walz');

// 3. Вложена таблица в клетка. С израз, който спира на първото „</table>“,
//    външната таблица се реже и всичко под вложената изчезва.
const inner = parseMedallists(`
<div class="mw-heading"><h2 id="Rowing">Rowing</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Men's eight</td><td><table class="nested"><tr><td>Crew list</td></tr></table>Germany</td><td>Great Britain</td><td>Netherlands</td></tr>
<tr><td>Women's eight</td><td>United States</td><td>Great Britain</td><td>Romania</td></tr>
</tbody></table>`);
assert.equal(inner.events.length, 2, 'редът след вложената таблица не се губи');
assert.ok(!inner.events.some((e) => e.event === 'Crew list'), 'редът на вложената не е дисциплина');

console.log('минават и трите случая от истинските страници');

// 4. Една дисциплина на няколко реда. Боксът раздава два бронза, а при
//    равенство златото е на двама — клетката с дисциплината е слята надолу.
//    Преди разгъването на слетите клетки тези редове просто изчезваха; след
//    него станаха по две дисциплини с едно и също име и страницата падна на
//    проверката за повторени. И двете са грешни: това е една дисциплина.
const shared = parseMedallists(`
<div class="mw-heading"><h2 id="Boxing">Boxing</h2></div>
<div class="mw-heading"><h3 id="Men">Men</h3></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td rowspan="2">Light flyweight</td><td rowspan="2">Hasanboy Dusmatov</td><td rowspan="2">Yuberjen Martínez</td><td>Joahnys Argilagos</td></tr>
<tr><td>Nico Hernández</td></tr>
</tbody></table>
<div class="mw-heading"><h2 id="Athletics">Athletics</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td rowspan="2">High jump</td><td>Gianmarco Tamberi</td><td rowspan="2">Not awarded</td><td rowspan="2">Maksim Nedasekau</td></tr>
<tr><td>Mutaz Essa Barshim</td></tr>
</tbody></table>`);
assert.equal(shared.events.length, 2, 'две дисциплини, не четири');
assert.equal(shared.events[0].bronze, 'Joahnys Argilagos · Nico Hernández', 'двата бронза в един запис');
assert.equal(shared.events[0].gold, 'Hasanboy Dusmatov', 'златото не се повтаря');
assert.equal(shared.events[1].gold, 'Gianmarco Tamberi · Mutaz Essa Barshim', 'деленото злато е на двамата');
assert.equal(shared.events[1].silver, 'Not awarded', 'сребро няма при делено злато');

console.log('минава и споделеният медал');

// 5. Заглавие ВЪТРЕ в таблицата. Париж 2024 слага мъжете и жените в една
//    таблица за кану-спринт, разделени с ред от една клетка по цялата ширина.
//    „C-2 500 metres“ излизаше два пъти без нищо, което да ги различи.
const inTable = parseMedallists(`
<div class="mw-heading"><h2 id="Canoeing">Canoeing</h2></div>
<div class="mw-heading"><h3 id="Sprint">Sprint</h3></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><th colspan="4">Men</th></tr>
<tr><td>C-2 500 metres</td><td>Liu Hao</td><td>Gabriele Casadei</td><td>Joan Antoni Moreno</td></tr>
<tr><th colspan="4">Women</th></tr>
<tr><td>C-2 500 metres</td><td>Xu Shixiao</td><td>Liudmyla Luzan</td><td>Sloan MacKenzie</td></tr>
</tbody></table>`);
assert.equal(inTable.events.length, 2, 'двете състезания са два записа');
assert.equal(inTable.events[0].category, 'Sprint · Men', 'редът-заглавие се долепя към категорията');
assert.equal(inTable.events[1].category, 'Sprint · Women');
assert.ok(!inTable.events.some((e) => e.event === 'Men' || e.event === 'Women'),
  'редът-заглавие не е станал дисциплина');

console.log('минава и заглавието вътре в таблицата');

// 6. Признакът е на самата таблица. Париж 2024 дава кану-спринта в две
//    таблици под едно h3 „Sprint“ — мъжка и женска — и разликата е само в
//    надписа на таблицата или в първия ѝ ред, разпънат по ширината.
const captioned = parseMedallists(`
<div class="mw-heading"><h2 id="Canoeing">Canoeing</h2></div>
<div class="mw-heading"><h3 id="Sprint">Sprint</h3></div>
<table class="wikitable"><caption>Men's events</caption><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>C-2 500 metres</td><td>Liu Hao</td><td>Gabriele Casadei</td><td>Joan Antoni Moreno</td></tr>
</tbody></table>
<table class="wikitable"><tbody>
<tr><th colspan="4">Women's events</th></tr>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>C-2 500 metres</td><td>Xu Shixiao</td><td>Liudmyla Luzan</td><td>Sloan MacKenzie</td></tr>
</tbody></table>`);
assert.equal(captioned.events.length, 2, 'двете състезания са два записа');
assert.equal(captioned.events[0].category, "Sprint · Men's events", 'надписът на таблицата се брои');
assert.equal(captioned.events[1].category, "Sprint · Women's events", 'и първият ред по цялата ширина');
assert.ok(!captioned.events.some((e) => /events$/.test(e.event)), 'надписът не е дисциплина');

console.log('минава и надписът на таблицата')

// 7. Получерен надред, който не е заглавие. В уикитекста „;Men“, в HTML <dt>.
//    Париж 2024 дели кану-спринта точно така: две таблици под едно h3
//    „Sprint“, без пол в имената на дисциплините и без нищо друго между тях.
const dt = parseMedallists(`
<div class="mw-heading"><h2 id="Canoeing">Canoeing</h2></div>
<div class="mw-heading"><h3 id="Sprint">Sprint</h3></div>
<dl><dt>Men</dt></dl>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>C-2 500 metres</td><td>Liu Hao</td><td>Gabriele Casadei</td><td>Joan Antoni Moreno</td></tr>
</tbody></table>
<dl><dt>Women</dt></dl>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>C-2 500 metres</td><td>Xu Shixiao</td><td>Liudmyla Luzan</td><td>Sloan MacKenzie</td></tr>
</tbody></table>
<div class="mw-heading"><h2 id="Cycling">Cycling</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>Road race</td><td>Remco Evenepoel</td><td>Valentin Madouas</td><td>Christophe Laporte</td></tr>
</tbody></table>`);
assert.equal(dt.events.length, 3);
assert.equal(dt.events[0].category, 'Sprint · Men', 'надредът се брои като най-долно ниво');
assert.equal(dt.events[1].category, 'Sprint · Women');
assert.equal(dt.events[2].category, undefined, 'и пада при следващото истинско заглавие');

console.log('минава и получереният надред');

// 8. Отборна клетка. Държавата и имената са разделени с край на ред, който
//    изчезваше без следа: „RomaniaAndrei CorneaMarian Enache“.
const team = parseMedallists(`
<div class="mw-heading"><h2 id="Rowing">Rowing</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr>
<td><a>Double sculls</a><br><a>details</a></td>
<td><span class="flagicon"><img src="ro.png"></span><a>Romania</a><br><a>Andrei Cornea</a><br><a>Marian Enache</a></td>
<td><ul><li>Netherlands</li><li>Melvin Twellaar</li><li>Stef Broenink</li></ul></td>
<td><a>Oliver Zeidler</a>&nbsp;<small><a>Germany</a></small></td>
</tr>
</tbody></table>`);
assert.equal(team.events.length, 1);
assert.equal(team.events[0].gold, 'Romania, Andrei Cornea, Marian Enache', 'имената вече не са слепени');
assert.equal(team.events[0].silver, 'Netherlands, Melvin Twellaar, Stef Broenink', 'и от списък с точки');
assert.equal(team.events[0].bronze, 'Oliver Zeidler Germany', 'индивидуалната клетка е както преди');
// Краят на ред пред „details“ не бива да оставя запетая след името.
assert.equal(team.events[0].event, 'Double sculls', 'без „, details“ накрая');

// Черта в клетката дели двама носители на един медал (тройното сребро на
// 100 метра бътерфлай в Рио). Изчезваше без следа и лепеше имената.
const hr = parseMedallists(`
<div class="mw-heading"><h2 id="Swimming">Swimming</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>100 metre butterfly</td><td>Joseph Schooling<br>Singapore</td>
<td>Michael Phelps<br>United States<hr>Chad le Clos<br>South Africa<hr>László Cseh<br>Hungary</td>
<td>Not awarded</td></tr>
</tbody></table>`);
assert.equal(hr.events[0].silver,
  'Michael Phelps, United States · Chad le Clos, South Africa · László Cseh, Hungary',
  'тримата със сребро са трима, не един слепен');

// Пояснение в скоби на нов ред не е нов запис.
const paren = parseMedallists(`
<div class="mw-heading"><h2 id="Athletics">Athletics</h2></div>
<table class="wikitable"><tbody>
<tr><th>Event</th><th>Gold</th><th>Silver</th><th>Bronze</th></tr>
<tr><td>High jump</td><td>Gianmarco Tamberi</td><td>Not awarded<br>(as there was a tie for gold)</td><td>Maksim Nedasekau</td></tr>
</tbody></table>`);
assert.equal(paren.events[0].silver, 'Not awarded (as there was a tie for gold)',
  'скобата не става отделна част');

console.log('минава и отборната клетка');
