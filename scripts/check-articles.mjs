/*
  Проверка преди билд. Правилата от Стъпка 2 и Стъпка 5 се спазват от билда,
  а не от паметта ни:
    - поне два независими източника (това го налага схемата на колекцията)
    - поне MIN_WORDS думи, защото под този обем AdSense отказва
*/
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'src/content/articles';
const MIN_WORDS = 600;

const files = (await readdir(DIR)).filter((f) => f.endsWith('.md'));
const problems = [];

for (const file of files) {
  const raw = await readFile(join(DIR, file), 'utf8');
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const words = body
    .replace(/\|[^\n]*\|/g, ' ')       // таблиците не се броят за текст
    .replace(/[#*_>`\[\]()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  if (words < MIN_WORDS) {
    problems.push(`${file}: ${words} думи, минимумът е ${MIN_WORDS}`);
  }
}

if (problems.length) {
  console.error('\nСтатии под минималния обем:\n' + problems.map((p) => '  - ' + p).join('\n') + '\n');
  process.exit(1);
}
console.log(`Проверени ${files.length} статии, всички над ${MIN_WORDS} думи.`);
