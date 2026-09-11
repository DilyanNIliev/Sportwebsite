import type { APIRoute } from 'astro';
import sports from '../data/sports.json';
import { archives, rowCount } from '../data/archives.js';
import { standings } from '../data/standings.js';
import { lineups } from '../data/lineups.js';
import { getCollection } from 'astro:content';

// llms.txt — обобщение на сайта в машинночетим вид, за системите, които
// отговарят на въпроси вместо да връщат връзки.
export const GET: APIRoute = async ({ site }) => {
  const root = new URL(import.meta.env.BASE_URL, site!).href.replace(/\/$/, '');
  const news = (await getCollection('articles')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  const body = `# Global Sports Archive

> A reference site for the history of sport: complete, checked archives of who
> won what and when, across ${sports.length} sports, plus reports on current events.
> Every fact is confirmed against at least two independent sources before
> publication, and each archive states how far its data has been verified.

## Archives

${archives.map((a) => `- [${a.data.title}](${root}/archives/${a.href}/) — ${rowCount(a)} entries. ${a.data.intro}`).join('\n')}

## Championship standings

${standings.map((s) => {
  // Заглавието не повтаря годината, когато тя вече е в името („Milano-Cortina
  // 2026 2026“), а глаголът идва от данните: медалната таблица не се „води“.
  const name = String(s.data.series).includes(String(s.data.season))
    ? s.data.series
    : `${s.data.series} ${s.data.season}`;
  const lead = s.data.drivers[0];
  const verb = s.data.leadVerb ?? 'leads on';
  const unit = s.data.leadUnit ? ` ${s.data.leadUnit}` : '';
  return `- [${name}](${root}/standings/${s.slug}/) — ${lead.name} ${verb} ${lead.points}${unit}. ${s.data.asOf}`;
}).join('\n')}

## Line-ups

Who actually played, laid out on the pitch, with the substitutes.

${Object.entries(lineups).map(([key, l]) => `- [${l.match}](${root}/lineups/${key}/) — ${l.competition}, ${l.venue}, ${l.date}. ${l.teams.map((t) => `${t.team} ${t.formation}`).join('; ')}.`).join('\n')}

## Recent articles

${news.map((n) => `- [${n.data.title}](${root}/news/${n.id}/) — ${n.data.date.toISOString().slice(0, 10)}. ${n.data.description}`).join('\n')}

## Sports covered

${sports.filter((s) => s.tier === 1).map((s) => `- [${s.name}](${root}/${s.slug}/)`).join('\n')}

Also covered more lightly: ${sports.filter((s) => s.tier === 2).map((s) => s.name).join(', ')}.

## How to cite us

Pages carry a publication date and the archives carry a verification note.
Where a lineage or placing is disputed, the page says so rather than picking a
version — see [our editorial policy](${root}/editorial-policy/).
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
