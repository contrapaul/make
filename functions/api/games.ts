import { json } from './_lib/http';

const PAGE_SIZE = 20;

// GET /api/games — public feed of finished games, newest first.
// ?coach=<username> filters to games that coach played in.
export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const coach = url.searchParams.get('coach') || '';
  const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10) || 0);

  let sql = `SELECT g.code, g.home_team_name, g.away_team_name, g.home_score, g.away_score,
                    g.finished_at, hu.username AS host, gu.username AS guest
             FROM live_games g
             JOIN users hu ON hu.id = g.host_user_id
             LEFT JOIN users gu ON gu.id = g.guest_user_id
             WHERE g.status = 'done' AND g.finished_at IS NOT NULL`;
  const binds: any[] = [];
  if (coach) {
    binds.push(coach);
    sql += ` AND (hu.username = ?${binds.length} COLLATE NOCASE OR gu.username = ?${binds.length} COLLATE NOCASE)`;
  }
  sql += ` ORDER BY g.finished_at DESC LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}`;

  const { results } = await context.env.DB.prepare(sql).bind(...binds).all();
  const hasMore = results.length > PAGE_SIZE;
  return json({
    games: results.slice(0, PAGE_SIZE).map((g: any) => ({
      code: g.code,
      host: g.host,
      guest: g.guest,
      homeTeam: g.home_team_name,
      awayTeam: g.away_team_name,
      homeScore: g.home_score,
      awayScore: g.away_score,
      finishedAt: g.finished_at,
    })),
    page,
    hasMore,
  });
};
