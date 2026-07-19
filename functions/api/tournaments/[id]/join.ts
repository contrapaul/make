import { HttpError, json, readJson, requireUser } from '../../_lib/http';
import { getTournament } from './index';

// POST /api/tournaments/:id/join — enter with one of my cloud teams.
export const onRequestPost = async (context: any) => {
  const { env, params, request } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.status !== 'open') throw new HttpError(409, 'Registration is closed for this tournament.');

  const body = await readJson(request);
  const team = await env.DB.prepare(
    'SELECT id, name, base_team_id FROM teams WHERE id = ?1 AND user_id = ?2'
  ).bind(String(body.teamId || ''), user.id).first();
  if (!team) throw new HttpError(400, 'Pick one of your cloud teams to enter with.');

  await env.DB.prepare(
    `INSERT INTO tournament_entries (tournament_id, user_id, team_id, team_name, base_team_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(tournament_id, user_id) DO UPDATE SET team_id = ?3, team_name = ?4, base_team_id = ?5`
  ).bind(t.id, user.id, team.id, team.name, team.base_team_id, Date.now()).run();
  return json({ ok: true });
};

// DELETE /api/tournaments/:id/join — withdraw myself (while registration is open).
export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.status !== 'open') throw new HttpError(409, 'Registration is closed — ask the organizer to remove you.');
  await env.DB.prepare(
    'DELETE FROM tournament_entries WHERE tournament_id = ?1 AND user_id = ?2'
  ).bind(t.id, user.id).run();
  return json({ ok: true });
};
