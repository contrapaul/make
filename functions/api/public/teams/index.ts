import { json } from '../../_lib/http';

const PAGE_SIZE = 20;

// Public team gallery: ?race=<baseTeamId>&q=<name search>&page=<0-based>
export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const race = url.searchParams.get('race') || '';
  const q = url.searchParams.get('q') || '';
  const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10) || 0);

  let sql = `SELECT t.id, t.name, t.base_team_id, t.updated_at, u.username
             FROM teams t JOIN users u ON u.id = t.user_id
             WHERE t.is_public = 1`;
  const binds: any[] = [];
  if (race) {
    binds.push(race);
    sql += ` AND t.base_team_id = ?${binds.length}`;
  }
  if (q) {
    binds.push('%' + q.replace(/[%_]/g, '') + '%');
    sql += ` AND t.name LIKE ?${binds.length}`;
  }
  sql += ` ORDER BY t.updated_at DESC LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}`;

  const { results } = await context.env.DB.prepare(sql).bind(...binds).all();
  const hasMore = results.length > PAGE_SIZE;
  return json({
    teams: results.slice(0, PAGE_SIZE).map((t: any) => ({
      id: t.id,
      name: t.name,
      baseTeamId: t.base_team_id,
      updatedAt: t.updated_at,
      owner: t.username,
    })),
    page,
    hasMore,
  });
};
