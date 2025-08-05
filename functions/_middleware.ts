import type { PagesFunction, EventContext } from '@cloudflare/workers-types';

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export const onRequest: PagesFunction<Env> = async (context: EventContext<Env, any, Record<string, unknown>>) => {
  const { request, next, env } = context;
  try {
    const response = await next();
    if (response.status === 404) {
      const indexPage = await env.ASSETS.fetch(new URL('/index.html', request.url));
      return new Response(indexPage.body, {
        headers: indexPage.headers,
        status: 200,
      });
    }
    return response;
  } catch (err) {
    return new Response('An error occurred', { status: 500 });
  }
};