export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`
    SELECT visits.id, visits.card_id, visits.visited_at,
           cards.title, cards.description, cards.category
    FROM visits
    LEFT JOIN cards ON visits.card_id = cards.id
    ORDER BY visits.visited_at DESC
  `).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const { card_id } = await request.json();
  if (!card_id) {
    return new Response('card_id is required', { status: 400 });
  }
  await env.DB.prepare('INSERT INTO visits (card_id) VALUES (?)').bind(card_id).run();
  return Response.json({ ok: true });
}
