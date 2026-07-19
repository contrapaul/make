import { json, requireUser } from '../_lib/http';

// List my teams (metadata only — the data blob is fetched per-team).
export const onRequestGet = async (context: any) => {
  const user = requireUser(context.data);
  const { results } = await context.env.DB.prepare(
    `SELECT id, name, base_team_id, is_public, created_at, updated_at
     FROM teams WHERE user_id = ?1 ORDER BY updated_at DESC`
  )
    .bind(user.id)
    .all();
  return json({
    teams: results.map((t: any) => ({
      id: t.id,
      name: t.name,
      baseTeamId: t.base_team_id,
      isPublic: !!t.is_public,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
  });
};
