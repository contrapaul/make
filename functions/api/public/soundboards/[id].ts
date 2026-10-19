import { HttpError, json } from '../../_lib/http';

// Read-only view of any public soundboard (enables signed-out playback of a
// shared board). Mirrors public/teams/[id].ts — no auth, gated on is_public.
export const onRequestGet = async (context: any) => {
  const row = await context.env.DB.prepare(
    `SELECT b.id, b.name, b.is_public, b.updated_at, b.data, u.username
     FROM soundboards b JOIN users u ON u.id = b.user_id
     WHERE b.id = ?1 AND b.is_public = 1`
  )
    .bind(context.params.id)
    .first();
  if (!row) throw new HttpError(404, 'Board not found.');
  return json({
    board: {
      id: row.id,
      name: row.name,
      isPublic: !!row.is_public,
      updatedAt: row.updated_at,
      owner: row.username,
      data: JSON.parse(row.data),
    },
  });
};
