import { HttpError, readJson, requireUser } from '../../_lib/http';
import { doCall, validCode } from '../_lib';

const MAX_TEAM_BYTES = 300 * 1024;

// Guest joins with one of their cloud teams.
export const onRequestPost = async (context: any) => {
  const { env, request } = context;
  const user = requireUser(context.data);
  const code = String(context.params.code || '').toUpperCase();
  if (!validCode(code)) throw new HttpError(404, 'Game not found.');

  const body = await readJson(request);
  if (!body.guestTeam?.draft) throw new HttpError(400, 'Missing guestTeam.');
  if (JSON.stringify(body.guestTeam).length > MAX_TEAM_BYTES) throw new HttpError(413, 'Team data too large.');

  const res = await doCall(env, code, 'join', {
    guest: { userId: user.id, username: user.username },
    guestTeam: body.guestTeam,
  });
  if (res.ok) {
    await env.DB.prepare(
      "UPDATE live_games SET guest_user_id = ?1, status = 'active' WHERE code = ?2"
    )
      .bind(user.id, code)
      .run();
  }
  return res;
};
