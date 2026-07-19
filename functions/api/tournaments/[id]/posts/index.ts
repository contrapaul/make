import { HttpError, json, readJson, requireUser } from '../../../_lib/http';
import { getTournament, isParticipant } from '../index';

// GET /api/tournaments/:id/posts — the photo wall, visible to everyone.
export const onRequestGet = async (context: any) => {
  const { env, params } = context;
  const t = await getTournament(env, params.id);
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.photo_id, p.caption, p.created_at, p.user_id, u.username
     FROM tournament_posts p JOIN users u ON u.id = p.user_id
     WHERE p.tournament_id = ?1 ORDER BY p.created_at DESC LIMIT 100`
  ).bind(t.id).all();
  return json({
    posts: results.map((p: any) => ({
      id: p.id,
      photoUrl: `/api/photos/${p.photo_id}`,
      caption: p.caption,
      coach: p.username,
      userId: p.user_id,
      createdAt: p.created_at,
    })),
  });
};

// POST — participants (and the organizer) share a photo + caption.
// {photoId, caption} — photo uploaded first via POST /api/photos.
export const onRequestPost = async (context: any) => {
  const { env, params, request } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.owner_id !== user.id && !(await isParticipant(env, t.id, user.id))) {
    throw new HttpError(403, 'Only coaches in this tournament can post to its wall.');
  }

  const body = await readJson(request);
  const caption = String(body.caption || '').trim().slice(0, 280);
  const photoId = String(body.photoId || '');
  const photo = await env.DB.prepare(
    'SELECT id FROM photos WHERE id = ?1 AND user_id = ?2'
  ).bind(photoId, user.id).first();
  if (!photo) throw new HttpError(400, 'Upload the photo first, then attach it.');

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO tournament_posts (id, tournament_id, user_id, photo_id, caption, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
  ).bind(id, t.id, user.id, photoId, caption, Date.now()).run();
  return json({ id });
};
