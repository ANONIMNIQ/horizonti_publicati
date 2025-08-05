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

    // --- TEMPORARY DEBUGGING ---
    // We will return the title of the page to see what we're actually getting.
    const pageTitle = $('title').text();
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    return new Response(JSON.stringify({ debug_title: pageTitle }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    });
    // --- END TEMPORARY DEBUGGING ---

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}