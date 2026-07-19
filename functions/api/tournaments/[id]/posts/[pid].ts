import { HttpError, json, requireUser } from '../../../_lib/http';
import { getTournament } from '../index';

// DELETE — post author or the organizer. Cleans up the photo too.
export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  const post = await env.DB.prepare(
    'SELECT * FROM tournament_posts WHERE id = ?1 AND tournament_id = ?2'
  ).bind(params.pid, t.id).first();
  if (!post) throw new HttpError(404, 'Post not found.');
  if (post.user_id !== user.id && t.owner_id !== user.id) {
    throw new HttpError(403, 'Only the author or the organizer can delete a post.');
  }

  await env.DB.prepare('DELETE FROM tournament_posts WHERE id = ?1').bind(post.id).run();
  // Wall photos are dedicated uploads — remove from R2 unless another post kept it.
  const stillUsed = await env.DB.prepare(
    'SELECT 1 FROM tournament_posts WHERE photo_id = ?1 LIMIT 1'
  ).bind(post.photo_id).first();
  if (!stillUsed) {
    await env.DB.prepare('DELETE FROM photos WHERE id = ?1').bind(post.photo_id).run();
    await env.PHOTOS.delete(`photos/${post.photo_id}.jpg`);
  }
  return json({ ok: true });
};
