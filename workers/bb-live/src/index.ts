/* bb-live — Durable Object hosting one live Blood Bowl game per share code.
 *
 * All access comes through Pages Functions (/api/live/*), which handle
 * session auth and pass the caller's identity via X-BB-User / X-BB-Username
 * headers. The DO itself never talks to D1 or Resend.
 *
 * Model: the "driver" (host or guest) runs the game on their device and
 * streams full state snapshots; everyone else mirrors them. The driver
 * follows the active team automatically (host = home, guest = away), with
 * a manual pass-control escape hatch. Spectators are read-only.
 */

interface Meta {
  code: string;
  gameMode: string;
  host: { userId: string; username: string } | null;
  guest: { userId: string; username: string } | null;
  hostTeam: any;   // {kind:'default',id} | {kind:'custom',draft}
  guestTeam: any;  // {kind:'custom',draft} (guests always bring cloud teams)
  driver: 'host' | 'guest';
  status: 'waiting' | 'active' | 'done';
  createdAt: number;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class LiveGame {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async meta(): Promise<Meta | undefined> {
    return this.state.storage.get('meta');
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path.endsWith('/ws')) return this.handleWs(request);

    const meta = await this.meta();

    if (path.endsWith('/init') && request.method === 'POST') {
      if (meta) return json({ error: 'Game already exists.' }, 409);
      const body: any = await request.json();
      const fresh: Meta = {
        code: body.code,
        gameMode: body.gameMode || 'seasoned',
        host: body.host,
        guest: null,
        hostTeam: body.hostTeam,
        guestTeam: null,
        driver: 'host',
        status: 'waiting',
        createdAt: Date.now(),
      };
      await this.state.storage.put('meta', fresh);
      return json({ ok: true });
    }

    if (!meta) return json({ error: 'Game not found.' }, 404);

    if (path.endsWith('/join') && request.method === 'POST') {
      const body: any = await request.json();
      if (meta.status === 'done') return json({ error: 'This game has finished.' }, 410);
      if (meta.host?.userId === body.guest?.userId) {
        return json({ error: 'You are the host of this game — open it from your own device.' }, 400);
      }
      if (meta.guest && meta.guest.userId !== body.guest?.userId) {
        return json({ error: 'Another coach already joined this game.' }, 409);
      }
      meta.guest = body.guest;
      meta.guestTeam = body.guestTeam;
      meta.status = 'active';
      await this.state.storage.put('meta', meta);
      this.broadcast(null, { type: 'guestJoined', meta: this.publicMeta(meta) });
      return json({ ok: true, meta: this.publicMeta(meta) });
    }

    if (path.endsWith('/meta') && request.method === 'GET') {
      const snap: any = await this.state.storage.get('snap');
      return json({ meta: this.publicMeta(meta), seq: snap?.seq ?? 0 });
    }

    return json({ error: 'Not found.' }, 404);
  }

  /* Meta as sent to clients (user ids swapped for a role the caller compares). */
  publicMeta(meta: Meta) {
    return {
      code: meta.code,
      gameMode: meta.gameMode,
      status: meta.status,
      driver: meta.driver,
      hostName: meta.host?.username || '?',
      guestName: meta.guest?.username || null,
      hostTeam: meta.hostTeam,
      guestTeam: meta.guestTeam,
      createdAt: meta.createdAt,
    };
  }

  async handleWs(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'Expected WebSocket.' }, 426);
    }
    const meta = await this.meta();
    if (!meta) return json({ error: 'Game not found.' }, 404);

    const userId = request.headers.get('X-BB-User') || null;
    let role: 'host' | 'guest' | 'spectator' = 'spectator';
    if (userId && meta.host?.userId === userId) role = 'host';
    else if (userId && meta.guest?.userId === userId) role = 'guest';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, userId });

    const snap: any = await this.state.storage.get('snap');
    server.send(JSON.stringify({
      type: 'init',
      role,
      meta: this.publicMeta(meta),
      snapshot: snap?.state ?? null,
      seq: snap?.seq ?? 0,
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let msg: any;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    const att = (ws as any).deserializeAttachment?.() || {};
    const meta = await this.meta();
    if (!meta) return;

    if (msg.type === 'snapshot') {
      if (att.role !== meta.driver) return;   // only the driver may write
      const prev: any = await this.state.storage.get('snap');
      const seq = (prev?.seq ?? 0) + 1;
      await this.state.storage.put('snap', { seq, state: msg.state });

      // Auto-flip: control follows the active team (host=home, guest=away).
      const active = msg.state?.activeTeam;
      let newDriver = meta.driver;
      if (active === 'home') newDriver = 'host';
      else if (active === 'away') newDriver = 'guest';
      if (msg.state?.phase === 'game_over') meta.status = 'done';
      const driverChanged = newDriver !== meta.driver || meta.status === 'done';
      if (driverChanged) {
        meta.driver = newDriver;
        await this.state.storage.put('meta', meta);
      }

      this.broadcast(ws, { type: 'snapshot', state: msg.state, seq, driver: meta.driver });
      if (driverChanged) ws.send(JSON.stringify({ type: 'control', driver: meta.driver }));
      return;
    }

    if (msg.type === 'passControl') {
      if (att.role !== 'host' && att.role !== 'guest') return;
      if (!meta.guest) return;                // nobody to pass to yet
      meta.driver = meta.driver === 'host' ? 'guest' : 'host';
      await this.state.storage.put('meta', meta);
      this.broadcast(null, { type: 'control', driver: meta.driver });
      return;
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    // Nothing required — reconnects get the latest snapshot from /ws init.
  }

  broadcast(except: WebSocket | null, payload: unknown) {
    const body = JSON.stringify(payload);
    for (const sock of this.state.getWebSockets()) {
      if (sock === except) continue;
      try { sock.send(body); } catch { /* closing socket — ignore */ }
    }
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response('bb-live: access via make.contrapaul.com/api/live/*', { status: 404 });
  },
};
