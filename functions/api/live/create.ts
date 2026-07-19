import { HttpError, json, readJson, requireUser } from '../_lib/http';
import { doCall, newCode } from './_lib';

const MAX_TEAM_BYTES = 300 * 1024;

// Host creates a two-device game with their team; returns the share code.
export const onRequestPost = async (context: any) => {
  const { env, request } = context;
  const user = requireUser(context.data);
  const body = await readJson(request);

  const hostTeam = body.hostTeam;
  if (!hostTeam || !hostTeam.kind) throw new HttpError(400, 'Missing hostTeam.');
  if (JSON.stringify(hostTeam).length > MAX_TEAM_BYTES) throw new HttpError(413, 'Team data too large.');

  const code = newCode();
  const res = await doCall(env, code, 'init', {
    code,
    gameMode: String(body.gameMode || 'seasoned'),
    host: { userId: user.id, username: user.username },
    hostTeam,
  });
  if (!res.ok) return res;

  await env.DB.prepare(
    'INSERT INTO live_games (code, host_user_id, status, created_at) VALUES (?1, ?2, ?3, ?4)'
  )
    .bind(code, user.id, 'waiting', Date.now())
    .run();
  return json({ code });
};
