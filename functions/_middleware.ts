import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

// By removing `: PagesFunction<Env>`, we let TypeScript infer the return type,
// which resolves the type conflict with Cloudflare's specific Response type.
export const onRequest = async ({ request, next, env }) => {
  try {
    const response = await next();
    if (response.status === 404) {
      const indexPage = await env.ASSETS.fetch(new URL('/index.html', request.url));
      return new Response(indexPage.body as any, {
        headers: Object.fromEntries(indexPage.headers.entries()),
        status: 200,
      });
    }
    return response;
  } catch (err) {
    return new Response('An error occurred', { status: 500 });
  }
};