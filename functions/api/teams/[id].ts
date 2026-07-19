import { HttpError, json, readJson, requireUser } from '../_lib/http';

const MAX_DATA_BYTES = 400 * 1024;

// Belt-and-braces: never let base64 dataURL photos into D1. The client
// uploads photos to R2 first; anything that slips through gets stripped.
function stripDataUrls(data: any): any {
  if (data && Array.isArray(data.players)) {
    for (const p of data.players) {
      if (typeof p.photo === 'string' && p.photo.startsWith('data:')) delete p.photo;
    }
  }
  return data;
}

async function getOwnedTeam(env: any, userId: string, id: string): Promise<any | null> {
  return env.DB.prepare('SELECT * FROM teams WHERE id = ?1 AND user_id = ?2').bind(id, userId).first();
}

export const onRequestGet = async (context: any) => {
  const user = requireUser(context.data);
  const team = await getOwnedTeam(context.env, user.id, context.params.id);
  if (!team) throw new HttpError(404, 'Team not found.');
  return json({
    team: {
      id: team.id,
      name: team.name,
      baseTeamId: team.base_team_id,
      isPublic: !!team.is_public,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
      data: JSON.parse(team.data),
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

  const name = String(body.name || '').slice(0, 80);
  const baseTeamId = String(body.baseTeamId || '');
  const isPublic = body.isPublic ? 1 : 0;
  const updatedAt = Number(body.updatedAt) || Date.now();
  if (!name || !baseTeamId || !body.data) throw new HttpError(400, 'Missing name, baseTeamId, or data.');
  if (isPublic && !user.email_verified) {
    throw new HttpError(403, 'Verify your email before making teams public.');
  }

  const data = JSON.stringify(stripDataUrls(body.data));
  if (data.length > MAX_DATA_BYTES) throw new HttpError(413, 'Team data is too large.');

  const existing = await env.DB.prepare('SELECT user_id, updated_at FROM teams WHERE id = ?1').bind(id).first();
  if (existing && existing.user_id !== user.id) throw new HttpError(403, 'Not your team.');
  if (existing && body.baseUpdatedAt != null && existing.updated_at > Number(body.baseUpdatedAt)) {
    throw new HttpError(409, 'A newer version of this team exists on the server.');
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO teams (id, user_id, name, base_team_id, is_public, data, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(id) DO UPDATE SET
       name = ?3, base_team_id = ?4, is_public = ?5, data = ?6, updated_at = ?8`
  )
    .bind(id, user.id, name, baseTeamId, isPublic, data, now, updatedAt)
    .run();
  return json({ ok: true, updatedAt });
};

export const onRequestDelete = async (context: any) => {
  const { env, params } = context;
  const user = requireUser(context.data);
  const team = await getOwnedTeam(env, user.id, params.id);
  if (!team) throw new HttpError(404, 'Team not found.');

  await env.DB.prepare('DELETE FROM teams WHERE id = ?1').bind(team.id).run();

  // Clean up photos no other team of this user still references.
  const photoIds: string[] = [];
  try {
    const data = JSON.parse(team.data);
    for (const p of data.players || []) if (p.photoId) photoIds.push(String(p.photoId));
  } catch {}
  for (const photoId of photoIds) {
    const stillUsed = await env.DB.prepare(
      "SELECT 1 FROM teams WHERE user_id = ?1 AND data LIKE '%' || ?2 || '%' LIMIT 1"
    )
      .bind(user.id, photoId)
      .first();
    if (!stillUsed) {
      await env.DB.prepare('DELETE FROM photos WHERE id = ?1 AND user_id = ?2').bind(photoId, user.id).run();
      await env.PHOTOS.delete(`photos/${photoId}.jpg`);
    }
  }
  return json({ ok: true });
};
