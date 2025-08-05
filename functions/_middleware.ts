interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Prevent the middleware from interfering with the API route
  if (url.pathname.startsWith('/api/')) {
    return next();
  }

  try {
    // Let the default asset handler try to find the file.
    const response = await next();

    // If it returns a 404, it means the file wasn't found.
    // This is likely a client-side route, so we should serve the SPA's entry point.
    if (response.status === 404) {
      // Fetch the index.html from the static assets.
      const indexPage = await env.ASSETS.fetch(new URL('/index.html', request.url));
      // Return the index.html content with a 200 status code.
      return new Response(indexPage.body, {
        headers: indexPage.headers,
        status: 200,
      });
    }

    // If the asset was found, return it as-is.
    return response;
  } catch (err) {
    // Fallback for any other errors
    return new Response('An error occurred', { status: 500 });
  }
};