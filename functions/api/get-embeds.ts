import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const articleUrl = url.searchParams.get('articleUrl');

  if (!articleUrl) {
    return new Response(JSON.stringify({ error: 'articleUrl is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);

    const mediaLinks: string[] = [];
    // Find all links that point to medium.com/media
    $('a[href*="medium.com/media"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        mediaLinks.push(href);
      }
    });

    const embedPromises = mediaLinks.map(async (link) => {
      try {
        // Step 2: Fetch each medium.com/media link
        const mediaResponse = await fetch(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (!mediaResponse.ok) {
          console.warn(`Failed to fetch media link ${link}: ${mediaResponse.statusText}`);
          return null;
        }

        const mediaHtml = await mediaResponse.text();
        const $$ = load(mediaHtml); // Use a new cheerio instance for the media HTML

        // Step 3: Extract the document.write content (which contains the actual embed HTML)
        const scriptContent = $$('script').html();
        if (scriptContent) {
          const writeMatch = scriptContent.match(/document\.write\("(.*)"\)/);
          if (writeMatch && writeMatch[1]) {
            // Decode the escaped HTML string
            const decodedHtml = writeMatch[1]
              .replace(/\\"/g, '"')
              .replace(/\\'/g, "'")
              .replace(/\\\//g, '/');
            return decodedHtml;
          }
        }
        return null;
      } catch (e) {
        console.error(`Error processing media link ${link}:`, e);
        return null;
      }
    });

    const embeds = (await Promise.all(embedPromises)).filter(Boolean) as string[];
    const hasTwitterEmbed = embeds.some(embed => embed.includes('twitter-tweet'));

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    return new Response(JSON.stringify({ embeds, hasTwitterEmbed }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}