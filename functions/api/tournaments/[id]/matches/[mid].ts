import { HttpError, json, readJson, requireUser } from '../../../_lib/http';
import { getTournament } from '../index';

async function getMatch(env: any, tournamentId: string, mid: string): Promise<any> {
  const m = await env.DB.prepare(
    'SELECT * FROM tournament_matches WHERE id = ?1 AND tournament_id = ?2'
  ).bind(mid, tournamentId).first();
  if (!m) throw new HttpError(404, 'Match not found.');
  return m;
}

// PUT — report a score. Organizer or either coach in the match.
export const onRequestPut = async (context: any) => {
  const { env, params, request } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  const m = await getMatch(env, t.id, params.mid);
  const allowed = user.id === t.owner_id || user.id === m.home_user_id || user.id === m.away_user_id;
  if (!allowed) throw new HttpError(403, 'Only the organizer or the two coaches can report this score.');
  if (m.away_user_id === null) throw new HttpError(400, 'Byes have no score.');

  const body = await readJson(request);
  const hs = parseInt(body.homeScore, 10);
  const as = parseInt(body.awayScore, 10);
  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0 || hs > 99 || as > 99) {
    throw new HttpError(400, 'Scores must be whole numbers (0-99).');
  }
  await env.DB.prepare(
    'UPDATE tournament_matches SET home_score = ?1, away_score = ?2 WHERE id = ?3'
  ).bind(hs, as, m.id).run();
  return json({ ok: true });
};

// DELETE — organizer removes a pairing.
export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.owner_id !== user.id) throw new HttpError(403, 'Only the organizer can delete pairings.');
  const m = await getMatch(env, t.id, params.mid);
  await env.DB.prepare('DELETE FROM tournament_matches WHERE id = ?1').bind(m.id).run();
  return json({ ok: true });
};
