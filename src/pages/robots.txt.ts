import type { APIRoute } from 'astro';

// Генерира се, за да сочи винаги към истинския sitemap на конфигурирания домейн.
export const GET: APIRoute = ({ site }) => {
  const root = new URL(import.meta.env.BASE_URL, site!).href.replace(/\/$/, '');
  const body = `# Global Sports Archive

User-agent: *
Allow: /

# Answer engines are welcome. Every page is served as complete HTML —
# nothing here needs JavaScript to be read.
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: ${root}/sitemap-index.xml
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
