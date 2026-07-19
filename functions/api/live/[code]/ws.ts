import { HttpError } from '../../_lib/http';
import { liveStub, validCode } from '../_lib';

// WebSocket upgrade, forwarded to the game's Durable Object with the
// caller's verified identity attached. Anonymous callers become spectators.
export const onRequestGet = async (context: any) => {
  const { request } = context;
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    throw new HttpError(426, 'Expected a WebSocket upgrade.');
  }
  const code = String(context.params.code || '').toUpperCase();
  if (!validCode(code)) throw new HttpError(404, 'Game not found.');

  const headers = new Headers(request.headers);
  headers.delete('X-BB-User');
  headers.delete('X-BB-Username');
  const user = context.data.user;
  if (user) {
    headers.set('X-BB-User', user.id);
    headers.set('X-BB-Username', user.username);
  }
  return liveStub(context.env, code).fetch(new Request(request.url, { method: 'GET', headers }));
};
