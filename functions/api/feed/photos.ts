import { json } from '../_lib/http';

const PAGE_SIZE = 20;

// GET /api/feed/photos — public, site-wide feed of tournament photo-wall
// posts (newest first), for the home-page activity feed. Same visibility
// as the per-tournament wall (GET /api/tournaments/:id/posts) — just not
// scoped to one tournament. ?page=<n> for the home feed's "Load more".
export const onRequestGet = async (context: any) => {
  const url = new URL(context.request.url);
  const page = Math.max(0, parseInt(url.searchParams.get('page') || '0', 10) || 0);

  const { results } = await context.env.DB.prepare(
    `SELECT p.id, p.photo_id, p.caption, p.created_at, u.username, t.id AS tournament_id, t.name AS tournament_name
     FROM tournament_posts p
     JOIN users u ON u.id = p.user_id
     JOIN tournaments t ON t.id = p.tournament_id
     ORDER BY p.created_at DESC LIMIT ${PAGE_SIZE + 1} OFFSET ${page * PAGE_SIZE}`
  ).all();
  const hasMore = results.length > PAGE_SIZE;
  return json({
    posts: results.slice(0, PAGE_SIZE).map((p: any) => ({
      id: p.id,
      photoUrl: `/api/photos/${p.photo_id}`,
      caption: p.caption,
      coach: p.username,
      tournamentId: p.tournament_id,
      tournamentName: p.tournament_name,
      createdAt: p.created_at,
    })),
    page,
    hasMore,
  });
};
