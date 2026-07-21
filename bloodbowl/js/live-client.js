/* BBLive — two-device / spectator layer for live games.
   The driver's device runs the normal game engine and streams every
   persisted snapshot (bb:statePersisted) to the game's Durable Object;
   other devices mirror snapshots into GameState and stay input-locked.
   Control follows the active team (host = Home, guest = Away), plus a
   manual pass-control button.

   Session (localStorage 'bb:liveGame'):
     { code, role: 'host'|'guest'|'spectator', meta: {gameMode, hostName,
       guestName, hostTeam, guestTeam, status, driver} } */
(function () {
  'use strict';

  const SESSION_KEY = 'bb:liveGame';
  const IS_GAME_PAGE = /\/game\/?$/.test(location.pathname.replace(/index\.html$/, ''));

  let _ws = null;
  let _driver = 'host';
  let _seq = 0;
  let _sendTimer = null;
  let _reconnects = 0;
  let _closing = false;
  let _pendingSnapshot = null;

  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clear() {
    _closing = true;
    try { _ws?.close(); } catch {}
    localStorage.removeItem(SESSION_KEY);
  }

  function isActive() { return !!session(); }
  function myRole() { return session()?.role || 'spectator'; }
  function isPassive() {
    if (!isActive()) return false;
    const role = myRole();
    return role === 'spectator' || _driver !== role;
  }

  /* Strip base64 photos before a team draft travels (URLs pass through). */
  function slimDraft(draft) {
    const copy = JSON.parse(JSON.stringify(draft));
    for (const p of copy.players ?? []) {
      if (typeof p.photo === 'string' && p.photo.startsWith('data:')) delete p.photo;
    }
    return copy;
  }

  /* ── Roster reconstruction on the game page ── */

  async function reconstructSides() {
    const meta = session()?.meta;
    if (!meta) return;
    const load = async (side, teamRef) => {
      if (!teamRef) return;
      if (teamRef.kind === 'default') await window.reconstructSide?.(side, { kind: 'default', id: teamRef.id });
      else if (teamRef.draft) await window.loadCustomTeam?.(side, teamRef.draft);
    };
    await load('left', meta.hostTeam);
    await load('right', meta.guestTeam);
  }

  /* ── Applying remote snapshots (passive devices) ── */

  function applySnapshot(state) {
    if (!state) return;
    try {
      localStorage.setItem(window.bbMatchKey ? window.bbMatchKey() : '', JSON.stringify(state));
    } catch {}
    if (!document.body.classList.contains('bb-game-ready')) { _pendingSnapshot = state; return; }
    window.rehydrateGlobals?.();
    window.rehydrateSide?.('left');
    window.rehydrateSide?.('right');
    window.BBGameRefresh?.();
  }

  /* Game page boots asynchronously — flush any snapshot that arrived early. */
  const _bootWatch = setInterval(() => {
    if (document.body.classList.contains('bb-game-ready')) {
      clearInterval(_bootWatch);
      if (_pendingSnapshot) { applySnapshot(_pendingSnapshot); _pendingSnapshot = null; }
      updateLock();
    }
  }, 300);

  /* ── WebSocket ── */

  function wsUrl(code) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/api/live/${code}/ws`;
  }

  function connect(onEvent) {
    const s = session();
    if (!s) return;
    _closing = false;
    const ws = new WebSocket(wsUrl(s.code));
    _ws = ws;

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.type === 'init') {
        _driver = msg.meta.driver;
        _seq = msg.seq || 0;
        const cur = session();
        if (cur) { cur.meta = msg.meta; cur.role = msg.role; saveSession(cur); }
        /* Adopt the stored snapshot: always when passive; as driver only if
           this device has no local save (fresh-device rejoin) — a driver's
           own localStorage is otherwise the same or newer. */
        if (msg.snapshot) {
          let haveLocal = false;
          try { haveLocal = !!localStorage.getItem(window.bbMatchKey?.() || ''); } catch {}
          if (isPassive() || !haveLocal) applySnapshot(msg.snapshot);
        }
        updateLock();
      } else if (msg.type === 'snapshot') {
        if (msg.seq <= _seq) return;
        _seq = msg.seq;
        const before = _driver;
        _driver = msg.driver;
        applySnapshot(msg.state);
        if (before !== _driver) updateLock();
      } else if (msg.type === 'control') {
        _driver = msg.driver;
        updateLock();
      }
      onEvent?.(msg);
      document.dispatchEvent(new CustomEvent('bb:liveEvent', { detail: msg }));
    };

    ws.onclose = () => {
      if (_closing) return;
      _reconnects += 1;
      setTimeout(() => connect(onEvent), Math.min(15000, 1500 * _reconnects));
      setBannerNote('reconnecting…');
    };
    ws.onopen = () => { _reconnects = 0; setBannerNote(''); };
  }

  /* Driver streams every persisted snapshot. */
  let _finished = false;
  document.addEventListener('bb:statePersisted', (e) => {
    if (!IS_GAME_PAGE || !isActive() || isPassive()) return;
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return;
    clearTimeout(_sendTimer);
    const state = e.detail;
    _sendTimer = setTimeout(() => {
      try { _ws.send(JSON.stringify({ type: 'snapshot', state })); } catch {}
      /* Full time: record the result for the games feed (idempotent). */
      if (state.phase === 'game_over' && !_finished) {
        _finished = true;
        setTimeout(() => {
          BBApi.request('POST', `/api/live/${session()?.code}/finish`, {}).catch(() => { _finished = false; });
        }, 500);
      }
    }, 200);
  });

  function passControl() {
    if (_ws?.readyState === WebSocket.OPEN) _ws.send(JSON.stringify({ type: 'passControl' }));
  }

  /* ── Lock + banner UI (game page only) ── */

  function banner() {
    let el = document.getElementById('bb-live-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bb-live-banner';
      el.innerHTML = `
        <span class="bb-live-dot"></span>
        <span id="bb-live-text"></span>
        <span id="bb-live-note"></span>
        <button id="bb-live-pass" type="button" hidden>Pass control</button>`;
      document.body.appendChild(el);
      el.querySelector('#bb-live-pass').addEventListener('click', passControl);
    }
    return el;
  }

  function setBannerNote(text) {
    const el = document.getElementById('bb-live-note');
    if (el) el.textContent = text;
  }

  function updateLock() {
    if (!IS_GAME_PAGE || !isActive()) return;
    const s = session();
    const role = myRole();
    const passive = isPassive();
    document.body.classList.toggle('bb-live-locked', passive);

    const el = banner();
    const text = el.querySelector('#bb-live-text');
    const pass = el.querySelector('#bb-live-pass');
    const names = { host: s.meta?.hostName || 'Host', guest: s.meta?.guestName || 'Guest' };

    if (role === 'spectator') {
      text.textContent = `LIVE ${s.code} — watching ${names.host} vs ${names.guest}`;
      pass.hidden = true;
    } else if (passive) {
      text.textContent = `LIVE ${s.code} — ${names[_driver]} has the reins`;
      pass.textContent = 'Take control';
      pass.hidden = false;
    } else {
      text.textContent = `LIVE ${s.code} — you have control`;
      pass.textContent = 'Pass control';
      pass.hidden = !s.meta?.guestName;
    }
    el.classList.toggle('is-passive', passive);
  }

  /* ── Host: create a game and wait for the opponent ── */

  async function createGame(gameMode) {
    const sel = window.getSelectedSides?.() || {};
    if (!sel.left) throw new Error('Pick your (Home) team first.');
    let hostTeam;
    if (sel.left.kind === 'custom') {
      const draft = (JSON.parse(localStorage.getItem('bb_teams') ?? '[]')).find((t) => t.id === sel.left.id);
      if (!draft) throw new Error('Could not find your team.');
      hostTeam = { kind: 'custom', id: draft.id, draft: slimDraft(draft) };
    } else {
      hostTeam = { kind: 'default', id: sel.left.id };
    }
    const { code } = await BBApi.request('POST', '/api/live/create', { gameMode, hostTeam });
    saveSession({ code, role: 'host', meta: { gameMode, hostTeam } });
    connect();
    return code;
  }

  /* Host lobby: when the guest arrives, sync their team into the session
     so the New Game screen can show it — the host confirms Start Game
     themselves (see index.html) rather than auto-entering the match. */
  document.addEventListener('bb:liveEvent', (e) => {
    if (IS_GAME_PAGE) return;
    const msg = e.detail;
    if (msg.type !== 'guestJoined') return;
    const s = session();
    if (!s || s.role !== 'host') return;
    s.meta = msg.meta;
    saveSession(s);
  });

  /* ── Boot on the game page ── */

  document.addEventListener('DOMContentLoaded', () => {
    if (IS_GAME_PAGE && isActive()) {
      connect();
      updateLock();
    }
  });

  window.BBLive = {
    isActive, isPassive, myRole, session, clear,
    reconstructSides, createGame, connect, passControl,
  };
})();
