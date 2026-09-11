import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    // По-кратко заглавие за раздела на браузъра и резултатите в Google;
    // видимото заглавие може да остане дълго и описателно.
    seoTitle: z.string().max(60).optional(),
    description: z.string(),
    sport: z.string(),
    // Уикенд, в който карат няколко серии, се появява във всеки от разделите им.
    alsoSports: z.array(z.string()).optional(),
    date: z.coerce.date(),
    author: z.string(),
    // Съставите на мача, ако има такива: името на файла в src/data/lineups.
    lineups: z.string().optional(),
    // Вътрешен одитен запис, не се показва на страницата. Редакционното правило
    // от Стъпка 2: факт се публикува при поне два независими източника.
    // Схемата го налага — статия с по-малко от два не се билдва.
    sources: z
      .array(z.object({ label: z.string(), url: z.string().url() }))
      .min(2, 'Всяка статия трябва да посочва поне два независими източника.'),
  }),
});

export const collections = { articles };
