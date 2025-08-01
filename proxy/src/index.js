export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = `https://api.1inch.dev${url.pathname}${url.search}`;
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') {
      return handleCORS(origin, env);
    }
    if (!isAllowedOrigin(origin, env)) {
      return new Response('Forbidden', { status: 403 });
    }
    try {
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${env.API_AUTH_TOKEN}`);
      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });
      const response = await fetch(proxyRequest, {
        cf: {
          // Always cache this fetch regardless of content type
          cacheTtl: 60 * 24, // 1 day
          cacheEverything: true,
        },
      });
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', origin);
      responseHeaders.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      responseHeaders.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
  },
};

function handleCORS(origin, env) {
  if (isAllowedOrigin(origin, env)) {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return new Response('Forbidden', { status: 403 });
}

function isAllowedOrigin(origin, env) {
  return (env.ALLOWED_ORIGIN ?? '').split(',').includes(origin);
}
