import { HttpError, json, readJson, requireUser } from '../_lib/http';

const PAGE_SIZE = 20;

// GET /api/tournaments — public list (newest first). ?mine=1 → only my own/joined.
// ?page=<n> opts into paged results (hasMore in the response); omitting it
// keeps the original one-shot behavior (top 50, no hasMore) so existing
// callers (the Tournaments page) are unaffected.
export const onRequestGet = async (context: any) => {
  const { env } = context;
  const url = new URL(context.request.url);
  const mine = url.searchParams.get('mine') === '1';
  const pageParam = url.searchParams.get('page');
  const page = pageParam !== null ? Math.max(0, parseInt(pageParam, 10) || 0) : null;
  let rows;
  if (mine) {
    const user = requireUser(context.data);
    ({ results: rows } = await env.DB.prepare(
      `SELECT t.id, t.name, t.status, t.created_at, u.username AS owner,
              (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS coaches
       FROM tournaments t JOIN users u ON u.id = t.owner_id
       WHERE t.owner_id = ?1 OR t.id IN (SELECT tournament_id FROM tournament_entries WHERE user_id = ?1)
       ORDER BY t.created_at DESC LIMIT 50`
    ).bind(user.id).all());
  } else if (page !== null) {
    ({ results: rows } = await env.DB.prepare(
      `SELECT t.id, t.name, t.status, t.created_at, u.username AS owner,
              (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS coaches
       FROM tournaments t JOIN users u ON u.id = t.owner_id
       ORDER BY t.created_at DESC LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}`
    ).all());
  } else {
    ({ results: rows } = await env.DB.prepare(
      `SELECT t.id, t.name, t.status, t.created_at, u.username AS owner,
              (SELECT COUNT(*) FROM tournament_entries e WHERE e.tournament_id = t.id) AS coaches
       FROM tournaments t JOIN users u ON u.id = t.owner_id
       ORDER BY CASE t.status WHEN 'done' THEN 1 ELSE 0 END, t.created_at DESC LIMIT 50`
    ).all());
  }
  const hasMore = page !== null && rows.length > PAGE_SIZE;
  const out = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return json({
    tournaments: out.map((t: any) => ({
      id: t.id, name: t.name, status: t.status, owner: t.owner,
      coaches: t.coaches, createdAt: t.created_at,
    })),
    ...(page !== null ? { page, hasMore } : {}),
  });
};

// POST /api/tournaments — create (verified email required, like public teams).
export const onRequestPost = async (context: any) => {
  const { env, request } = context;
  const user = requireUser(context.data);
  if (!user.email_verified) throw new HttpError(403, 'Verify your email before creating a tournament.');

  const body = await readJson(request);
  const name = String(body.name || '').trim().slice(0, 60);
  const description = String(body.description || '').trim().slice(0, 500);
  if (name.length < 3) throw new HttpError(400, 'Tournament name must be at least 3 characters.');

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO tournaments (id, owner_id, name, description, status, created_at) VALUES (?1, ?2, ?3, ?4, 'open', ?5)"
  ).bind(id, user.id, name, description, Date.now()).run();
  return json({ id });
};
