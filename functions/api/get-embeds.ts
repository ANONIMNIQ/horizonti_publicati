import { load } from 'cheerio';
import type { PagesFunction, EventContext } from '@cloudflare/workers-types';

interface Env {}

export const onRequestGet: PagesFunction<Env> = async (context: EventContext<Env, any, Record<string, unknown>>) => {
  const { request } = context;
  try {
    const url = new URL(request.url);
    const articleUrl = url.searchParams.get('articleUrl');
    if (!articleUrl) {
      return new Response(JSON.stringify({ error: 'articleUrl is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // ... rest of your implementation
    return new Response(JSON.stringify({ embeds: [] }), { // Replace with actual response
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};