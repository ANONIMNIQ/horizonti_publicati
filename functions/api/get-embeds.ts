import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// By removing `: PagesFunction<Env>`, we let TypeScript infer the return type,
// which resolves the type conflict with Cloudflare's specific Response type.
export const onRequestGet = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const articleUrl = url.searchParams.get('articleUrl');
    
    if (!articleUrl) {
      return new Response(JSON.stringify({ error: 'Missing articleUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Your embed fetching logic here
    const embeds: string[] = []; // Initialize with actual embeds
    const hasTwitterEmbed = false; // Set based on actual check

    return new Response(JSON.stringify({ embeds, hasTwitterEmbed }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};