import { HttpError, json } from '../_lib/http';

// GET /api/coach/:username — public profile: public teams + recent games.
export const onRequestGet = async (context: any) => {
  const { env, params } = context;
  const coach = await env.DB.prepare(
    'SELECT id, username, created_at FROM users WHERE username = ?1 COLLATE NOCASE'
  ).bind(String(params.username || '')).first();
  if (!coach) throw new HttpError(404, 'Coach not found.');

  const { results: teams } = await env.DB.prepare(
    `SELECT id, name, base_team_id, updated_at FROM teams
     WHERE user_id = ?1 AND is_public = 1 ORDER BY updated_at DESC LIMIT 50`
  ).bind(coach.id).all();

  const { results: games } = await env.DB.prepare(
    `SELECT g.code, g.home_team_name, g.away_team_name, g.home_score, g.away_score,
            g.finished_at, hu.username AS host, gu.username AS guest
     FROM live_games g
     JOIN users hu ON hu.id = g.host_user_id
     LEFT JOIN users gu ON gu.id = g.guest_user_id
     WHERE g.status = 'done' AND g.finished_at IS NOT NULL
       AND (g.host_user_id = ?1 OR g.guest_user_id = ?1)
     ORDER BY g.finished_at DESC LIMIT 20`
  ).bind(coach.id).all();

  return json({
    coach: { username: coach.username, createdAt: coach.created_at },
    teams: teams.map((t: any) => ({
      id: t.id, name: t.name, baseTeamId: t.base_team_id, updatedAt: t.updated_at,
    })),
    games: games.map((g: any) => ({
      code: g.code, host: g.host, guest: g.guest,
      homeTeam: g.home_team_name, awayTeam: g.away_team_name,
      homeScore: g.home_score, awayScore: g.away_score, finishedAt: g.finished_at,
    })),
  });
};
