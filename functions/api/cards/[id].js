export async function onRequestDelete({ params, env }) {
  const { id } = params;
  await env.DB.prepare('DELETE FROM visits WHERE card_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}

export async function onRequestPut({ params, request, env }) {
  const { id } = params;
  const { title, description, category, created_by, image_key, note } = await request.json();
  if (!title) {
    return new Response('title is required', { status: 400 });
  }
  await env.DB.prepare(
    'UPDATE cards SET title = ?, description = ?, category = ?, created_by = ?, image_key = ?, note = ? WHERE id = ?'
  ).bind(title, description || '', category || '', created_by || '', image_key || null, note || '', id).run();
  return Response.json({ ok: true });
}
