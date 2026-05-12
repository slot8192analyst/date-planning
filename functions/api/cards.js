// GET /api/cards : 一覧取得
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM cards ORDER BY created_at DESC'
  ).all();
  return Response.json(results);
}

// POST /api/cards : 追加
export async function onRequestPost({ request, env }) {
  const { title, description } = await request.json();
  if (!title) {
    return new Response('title is required', { status: 400 });
  }
  await env.DB.prepare(
    'INSERT INTO cards (title, description) VALUES (?, ?)'
  ).bind(title, description || '').run();
  return Response.json({ ok: true });
}
