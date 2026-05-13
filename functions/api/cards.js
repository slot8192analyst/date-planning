export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM cards ORDER BY created_at DESC'
  ).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const { title, description, category, created_by, image_key, note } = await request.json();
  if (!title) {
    return new Response('title is required', { status: 400 });
  }
  await env.DB.prepare(
    'INSERT INTO cards (title, description, category, created_by, image_key, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(title, description || '', category || '', created_by || '', image_key || null, note || '').run();
  return Response.json({ ok: true });
}
