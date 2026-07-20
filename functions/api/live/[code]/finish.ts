import { HttpError, json, requireUser } from '../../_lib/http';
import { liveStub, validCode } from '../_lib';

// POST /api/live/:code/finish — record the final result in D1 (feeds the
// games feed). Called by the driver's client at full time; idempotent, and
// the scores come from the Durable Object, not the caller.
export const onRequestPost = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const code = String(params.code || '').toUpperCase();
  if (!validCode(code)) throw new HttpError(404, 'Game not found.');

  const game = await env.DB.prepare('SELECT * FROM live_games WHERE code = ?1').bind(code).first();
  if (!game) throw new HttpError(404, 'Game not found.');
  if (user.id !== game.host_user_id && user.id !== game.guest_user_id) {
    throw new HttpError(403, 'Only the two coaches can record this game.');
  }
  if (game.finished_at) return json({ ok: true, already: true });

  const res = await liveStub(env, code).fetch('https://do/result');
  if (!res.ok) throw new HttpError(502, 'Could not read the game result.');
  const r: any = await res.json();
  if (r.phase !== 'game_over' && r.status !== 'done') {
    throw new HttpError(409, 'This game has not reached full time yet.');
  }

  await env.DB.prepare(
    `UPDATE live_games SET status = 'done', home_team_name = ?1, away_team_name = ?2,
       home_score = ?3, away_score = ?4, finished_at = ?5 WHERE code = ?6`
  )
    .bind(r.hostTeamName, r.guestTeamName, r.scores.home ?? 0, r.scores.away ?? 0, Date.now(), code)
    .run();
  return json({ ok: true });
};
