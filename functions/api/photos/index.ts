import { HttpError, json, requireUser } from '../_lib/http';

const MAX_BYTES = 300 * 1024;
const MAX_PHOTOS_PER_USER = 300;

// Upload one card photo (raw JPEG body). Returns { id, url }.
export const onRequestPost = async (context: any) => {
  const { env, request } = context;
  const user = requireUser(context.data);

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM photos WHERE user_id = ?1').bind(user.id).first();
  if (count.n >= MAX_PHOTOS_PER_USER) throw new HttpError(403, 'Photo storage limit reached.');

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) throw new HttpError(400, 'Empty upload.');
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'Photo too large (max 300 KB).');
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    throw new HttpError(400, 'Only JPEG photos are accepted.');
  }

  const id = crypto.randomUUID();
  await env.PHOTOS.put(`photos/${id}.jpg`, bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  await env.DB.prepare('INSERT INTO photos (id, user_id, size_bytes, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(id, user.id, bytes.length, Date.now())
    .run();
  return json({ id, url: `/api/photos/${id}` });
};
