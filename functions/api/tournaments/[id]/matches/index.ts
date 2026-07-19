import { HttpError, json, readJson, requireUser } from '../../../_lib/http';
import { getTournament, isParticipant } from '../index';

// POST /api/tournaments/:id/matches — organizer adds a pairing.
// {round, homeUserId, awayUserId|null}  (null away = bye, scores as a win)
export const onRequestPost = async (context: any) => {
  const { env, params, request } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.owner_id !== user.id) throw new HttpError(403, 'Only the organizer can create pairings.');
  if (t.status === 'done') throw new HttpError(409, 'This tournament has finished.');

  const body = await readJson(request);
  const round = Math.max(1, Math.min(99, parseInt(body.round, 10) || 1));
  const home = String(body.homeUserId || '');
  const away = body.awayUserId ? String(body.awayUserId) : null;
  if (!home || home === away) throw new HttpError(400, 'Pick two different coaches.');
  if (!(await isParticipant(env, t.id, home)) || (away && !(await isParticipant(env, t.id, away)))) {
    throw new HttpError(400, 'Both coaches must be registered in this tournament.');
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO tournament_matches (id, tournament_id, round, home_user_id, away_user_id, home_score, away_score, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, ?6)`
  ).bind(id, t.id, round, home, away, Date.now()).run();
  return json({ id });
};
