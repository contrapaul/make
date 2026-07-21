import { json } from '../_lib/http';

const LIMIT = 20;

// GET /api/feed/photos — public, site-wide feed of tournament photo-wall
// posts (newest first), for the home-page activity feed. Same visibility
// as the per-tournament wall (GET /api/tournaments/:id/posts) — just not
// scoped to one tournament.
export const onRequestGet = async (context: any) => {
  const { results } = await context.env.DB.prepare(
    `SELECT p.id, p.photo_id, p.caption, p.created_at, u.username, t.id AS tournament_id, t.name AS tournament_name
     FROM tournament_posts p
     JOIN users u ON u.id = p.user_id
     JOIN tournaments t ON t.id = p.tournament_id
     ORDER BY p.created_at DESC LIMIT ${LIMIT}`
  ).all();
  return json({
    posts: results.map((p: any) => ({
      id: p.id,
      photoUrl: `/api/photos/${p.photo_id}`,
      caption: p.caption,
      coach: p.username,
      tournamentId: p.tournament_id,
      tournamentName: p.tournament_name,
      createdAt: p.created_at,
    })),
  });
};
