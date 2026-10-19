import { HttpError, json, readJson, requireUser } from '../_lib/http';

const MAX_DATA_BYTES = 100 * 1024; // 100 KB of board JSON is ample

async function getOwnedBoard(env: any, userId: string, id: string): Promise<any | null> {
  return env.DB.prepare('SELECT * FROM soundboards WHERE id = ?1 AND user_id = ?2').bind(id, userId).first();
}

export const onRequestGet = async (context: any) => {
  const user = requireUser(context.data);
  const board = await getOwnedBoard(context.env, user.id, context.params.id);
  if (!board) throw new HttpError(404, 'Board not found.');
  return json({
    board: {
      id: board.id,
      name: board.name,
      isPublic: !!board.is_public,
      createdAt: board.created_at,
      updatedAt: board.updated_at,
      data: JSON.parse(board.data),
    },
  });
};

// Upsert. Last-write-wins on updatedAt; a stale client (baseUpdatedAt older
// than the server copy) gets a 409 and should re-pull before retrying.
export const onRequestPut = async (context: any) => {
  const { env, request, params } = context;
  const user = requireUser(context.data);
  const id = params.id;
  const body = await readJson(request);

  const name = String(body.name || 'My soundboard').slice(0, 80);
  const isPublic = body.isPublic ? 1 : 0;
  const updatedAt = Number(body.updatedAt) || Date.now();
  if (!body.data) throw new HttpError(400, 'Missing board data.');
  if (isPublic && !user.email_verified) {
    throw new HttpError(403, 'Verify your email before making boards public.');
  }

  const data = JSON.stringify(body.data);
  if (data.length > MAX_DATA_BYTES) throw new HttpError(413, 'Board data is too large.');

  const existing = await env.DB.prepare('SELECT user_id, updated_at FROM soundboards WHERE id = ?1').bind(id).first();
  if (existing && existing.user_id !== user.id) throw new HttpError(403, 'Not your board.');
  if (existing && body.baseUpdatedAt != null && existing.updated_at > Number(body.baseUpdatedAt)) {
    throw new HttpError(409, 'A newer version of this board exists on the server.');
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO soundboards (id, user_id, name, is_public, data, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(id) DO UPDATE SET
       name = ?3, is_public = ?4, data = ?5, updated_at = ?7`
  )
    .bind(id, user.id, name, isPublic, data, now, updatedAt)
    .run();
  return json({ ok: true, updatedAt });
};

export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const board = await getOwnedBoard(env, user.id, params.id);
  if (!board) throw new HttpError(404, 'Board not found.');
  await env.DB.prepare('DELETE FROM soundboards WHERE id = ?1').bind(board.id).run();
  // Sounds are intentionally NOT deleted — they belong to the user's library
  // and may be reused by other boards (D11).
  return json({ ok: true });
};
