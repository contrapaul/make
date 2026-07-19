import { HttpError, json, readJson, requireUser } from '../../_lib/http';

export async function getTournament(env: any, id: string): Promise<any> {
  const t = await env.DB.prepare(
    'SELECT t.*, u.username AS owner_name FROM tournaments t JOIN users u ON u.id = t.owner_id WHERE t.id = ?1'
  ).bind(id).first();
  if (!t) throw new HttpError(404, 'Tournament not found.');
  return t;
}

export async function isParticipant(env: any, tournamentId: string, userId: string): Promise<boolean> {
  return !!(await env.DB.prepare(
    'SELECT 1 FROM tournament_entries WHERE tournament_id = ?1 AND user_id = ?2'
  ).bind(tournamentId, userId).first());
}

/* Standings: 3/1/0 points, then TD difference, then TDs for. A bye
   (away_user_id NULL) counts as a win with no touchdowns. */
function standings(entries: any[], matches: any[]) {
  const rows = new Map(entries.map((e) => [e.user_id, {
    userId: e.user_id, coach: e.username, team: e.team_name, baseTeamId: e.base_team_id,
    played: 0, won: 0, drawn: 0, lost: 0, tdFor: 0, tdAgainst: 0, points: 0,
  }]));
  for (const m of matches) {
    const home = rows.get(m.home_user_id);
    if (m.away_user_id === null) {
      if (home) { home.played++; home.won++; home.points += 3; }
      continue;
    }
    if (m.home_score === null || m.away_score === null) continue;  // unreported
    const away = rows.get(m.away_user_id);
    if (home) { home.played++; home.tdFor += m.home_score; home.tdAgainst += m.away_score; }
    if (away) { away.played++; away.tdFor += m.away_score; away.tdAgainst += m.home_score; }
    if (m.home_score > m.away_score) { if (home) { home.won++; home.points += 3; } if (away) away.lost++; }
    else if (m.home_score < m.away_score) { if (away) { away.won++; away.points += 3; } if (home) home.lost++; }
    else { if (home) { home.drawn++; home.points += 1; } if (away) { away.drawn++; away.points += 1; } }
  }
  return [...rows.values()].sort((a, b) =>
    b.points - a.points ||
    (b.tdFor - b.tdAgainst) - (a.tdFor - a.tdAgainst) ||
    b.tdFor - a.tdFor ||
    a.coach.localeCompare(b.coach));
}

// GET /api/tournaments/:id — full detail: info, entries, matches, standings.
export const onRequestGet = async (context: any) => {
  const { env, params } = context;
  const t = await getTournament(env, params.id);
  const { results: entries } = await env.DB.prepare(
    `SELECT e.user_id, e.team_id, e.team_name, e.base_team_id, e.created_at, u.username
     FROM tournament_entries e JOIN users u ON u.id = e.user_id
     WHERE e.tournament_id = ?1 ORDER BY e.created_at`
  ).bind(t.id).all();
  const { results: matches } = await env.DB.prepare(
    'SELECT * FROM tournament_matches WHERE tournament_id = ?1 ORDER BY round, created_at'
  ).bind(t.id).all();

  const nameOf = new Map(entries.map((e: any) => [e.user_id, e.username]));
  return json({
    tournament: {
      id: t.id, name: t.name, description: t.description, status: t.status,
      owner: t.owner_name, ownerId: t.owner_id, createdAt: t.created_at,
    },
    entries: entries.map((e: any) => ({
      userId: e.user_id, coach: e.username, teamId: e.team_id,
      teamName: e.team_name, baseTeamId: e.base_team_id,
    })),
    matches: matches.map((m: any) => ({
      id: m.id, round: m.round,
      homeUserId: m.home_user_id, homeCoach: nameOf.get(m.home_user_id) || '?',
      awayUserId: m.away_user_id, awayCoach: m.away_user_id ? (nameOf.get(m.away_user_id) || '?') : null,
      homeScore: m.home_score, awayScore: m.away_score,
    })),
    standings: standings(entries, matches),
  });
};

// PUT /api/tournaments/:id — organizer edits status/name/description.
export const onRequestPut = async (context: any) => {
  const { env, params, request } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.owner_id !== user.id) throw new HttpError(403, 'Only the organizer can edit the tournament.');

  const body = await readJson(request);
  const status = body.status !== undefined ? String(body.status) : t.status;
  if (!['open', 'active', 'done'].includes(status)) throw new HttpError(400, 'Bad status.');
  const name = body.name !== undefined ? String(body.name).trim().slice(0, 60) : t.name;
  const description = body.description !== undefined ? String(body.description).trim().slice(0, 500) : t.description;
  if (name.length < 3) throw new HttpError(400, 'Tournament name must be at least 3 characters.');

  await env.DB.prepare(
    'UPDATE tournaments SET status = ?1, name = ?2, description = ?3 WHERE id = ?4'
  ).bind(status, name, description, t.id).run();
  return json({ ok: true });
};

// DELETE /api/tournaments/:id — organizer only.
export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const t = await getTournament(env, params.id);
  if (t.owner_id !== user.id) throw new HttpError(403, 'Only the organizer can delete the tournament.');
  await env.DB.prepare('DELETE FROM tournaments WHERE id = ?1').bind(t.id).run();
  return json({ ok: true });
};
