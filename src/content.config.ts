import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    sport: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    // Редакционното правило от Стъпка 2: факт се публикува при поне два
    // независими източника. Схемата го налага — по-малко от два не се билдва.
    sources: z
      .array(z.object({ label: z.string(), url: z.string().url() }))
      .min(2, 'Всяка статия трябва да посочва поне два независими източника.'),
  }),
});

export const collections = { articles };
