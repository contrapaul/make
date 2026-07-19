import { HttpError, json } from '../../_lib/http';

// Read-only view of any public team.
export const onRequestGet = async (context: any) => {
  const row = await context.env.DB.prepare(
    `SELECT t.id, t.name, t.base_team_id, t.data, t.updated_at, u.username
     FROM teams t JOIN users u ON u.id = t.user_id
     WHERE t.id = ?1 AND t.is_public = 1`
  )
    .bind(context.params.id)
    .first();
  if (!row) throw new HttpError(404, 'Team not found.');
  return json({
    team: {
      id: row.id,
      name: row.name,
      baseTeamId: row.base_team_id,
      updatedAt: row.updated_at,
      owner: row.username,
      data: JSON.parse(row.data),
    },
  });
};
