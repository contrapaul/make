import { HttpError, json, requireUser } from '../../../_lib/http';
import { getTournament } from '../index';

// DELETE — organizer removes an entry.
export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.owner_id !== user.id) throw new HttpError(403, 'Only the organizer can remove coaches.');
  await env.DB.prepare(
    'DELETE FROM tournament_entries WHERE tournament_id = ?1 AND user_id = ?2'
  ).bind(t.id, params.userId).run();
  return json({ ok: true });
};
