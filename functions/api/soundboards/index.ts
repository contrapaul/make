import { json, requireUser } from '../_lib/http';

// List my soundboards (metadata only — the data blob is fetched per-board).
export const onRequestGet = async (context: any) => {
  const user = requireUser(context.data);
  const { results } = await context.env.DB.prepare(
    `SELECT id, name, is_public, created_at, updated_at
     FROM soundboards WHERE user_id = ?1 ORDER BY updated_at DESC`
  )
    .bind(user.id)
    .all();
  return json({
    boards: results.map((b: any) => ({
      id: b.id,
      name: b.name,
      isPublic: !!b.is_public,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    })),
  });
};

// Create a new (empty) board. Returns { id, url, createdAt }; the client owns
// the full board schema and PUTs the real layout on first edit.
export const onRequestPost = async (context: any) => {
  const user = requireUser(context.data);
  const id = crypto.randomUUID();
  const now = Date.now();
  const name = 'My soundboard';
  const data = JSON.stringify({
    name,
    isPublic: false,
    master: { gain: 1 },
    layout: { cols: 9, rows: 6 },
    pads: [],
  });
  await context.env.DB.prepare(
    'INSERT INTO soundboards (id, user_id, name, is_public, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
  )
    .bind(id, user.id, name, 0, data, now, now)
    .run();
  return json({ id, url: `/api/soundboards/${id}`, createdAt: now });
};
