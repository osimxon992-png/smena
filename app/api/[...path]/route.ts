import { handle } from '../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Barcha /api/* so'rovlari lib/api.ts dagi bitta yo'naltirgichga tushadi
async function respond(req: Request) {
  const url = new URL(req.url);
  const res = await handle({
    method: req.method,
    path: url.pathname,
    cookie: req.headers.get('cookie'),
    contentType: req.headers.get('content-type'),
    body: req.method === 'POST' ? await req.text() : '',
    https: url.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https',
  });
  return new Response(JSON.stringify(res.data ?? null), {
    status: res.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(res.cookie ? { 'Set-Cookie': res.cookie } : {}),
    },
  });
}

export { respond as GET, respond as POST };
