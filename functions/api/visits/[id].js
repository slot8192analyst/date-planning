export async function onRequestDelete({ params, env }) {
  const { id } = params;
  await env.DB.prepare('DELETE FROM visits WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}
