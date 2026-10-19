import { HttpError, json, requireUser } from '../_lib/http';

// Sounds are public-readable by unguessable uuid (needed for shared boards);
// immutable cache headers make repeat loads nearly free at the edge.
export const onRequestGet = async (context: any) => {
  const id = context.params.id;
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, 'Not found.');
  const obj = await context.env.SOUNDS.get(`sounds/${id}`);
  if (!obj) throw new HttpError(404, 'Not found.');
  const mime = (obj.httpMetadata && obj.httpMetadata.contentType) || 'audio/mpeg';
  return new Response(obj.body, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const row = await env.DB.prepare('SELECT id FROM sounds WHERE id = ?1 AND user_id = ?2')
    .bind(params.id, user.id)
    .first();
  if (!row) throw new HttpError(404, 'Not found.');
  await env.DB.prepare('DELETE FROM sounds WHERE id = ?1').bind(params.id).run();
  await env.SOUNDS.delete(`sounds/${params.id}`);
  return json({ ok: true });
};
