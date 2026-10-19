import { HttpError, json, requireUser } from '../_lib/http';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_SOUNDS_PER_USER = 50;

// Upload one sound (raw audio body). Returns { id, url, name, size, mime }.
// Mirrors the photos upload path (size cap + per-user cap) but at 2 MB and
// accepting any audio/* content type. The original filename rides in
// X-Sound-Name so it survives into the D1 row.
export const onRequestPost = async (context: any) => {
  const { env, request } = context;
  const user = requireUser(context.data);

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sounds WHERE user_id = ?1')
    .bind(user.id)
    .first();
  if (count.n >= MAX_SOUNDS_PER_USER) throw new HttpError(403, 'Sound storage limit reached (50 sounds).');

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) throw new HttpError(400, 'Empty upload.');
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'Sound too large (max 2 MB).');

  const mime = (request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0].trim();
  if (!/^audio\//.test(mime)) throw new HttpError(400, 'Only audio files are accepted.');

  const name = String(request.headers.get('X-Sound-Name') || 'sound').slice(0, 120);
  const id = crypto.randomUUID();
  await env.SOUNDS.put(`sounds/${id}`, bytes, { httpMetadata: { contentType: mime } });
  await env.DB.prepare(
    'INSERT INTO sounds (id, user_id, name, mime, size_bytes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
  )
    .bind(id, user.id, name, mime, bytes.length, Date.now())
    .run();
  return json({ id, url: `/api/sounds/${id}`, name, size: bytes.length, mime });
};
