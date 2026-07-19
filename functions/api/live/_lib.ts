// Shared helpers for /api/live/* — talking to the LiveGame Durable Object.

export function liveStub(env: any, code: string) {
  const id = env.LIVE_GAME.idFromName(code.toUpperCase());
  return env.LIVE_GAME.get(id);
}

// Unambiguous alphabet (no 0/O/1/I) for share codes.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export function validCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code);
}

// Call an internal DO route and mirror its JSON response.
export async function doCall(env: any, code: string, path: string, body?: unknown): Promise<Response> {
  const res = await liveStub(env, code).fetch(`https://do/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
