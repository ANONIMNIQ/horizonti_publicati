import { load } from 'cheerio';

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

    const embeds: string[] = [];
    
    // Use a more specific selector. Medium wraps embeds in <figure> tags.
    // We select all figures, then filter for those containing an iframe.
    // We also select Twitter and Gist embeds directly.
    $('figure, blockquote.twitter-tweet, .gist').each((i, el) => {
      const element = $(el);
      // Check if the element is a figure containing an iframe, or if it's a tweet/gist.
      if ((element.is('figure') && element.find('iframe').length > 0) || element.is('blockquote.twitter-tweet, .gist')) {
        embeds.push($.html(el));
      }
    });

    const hasTwitterEmbed = $('blockquote.twitter-tweet').length > 0;

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