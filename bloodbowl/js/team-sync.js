/* BBTeamSync — mirrors localStorage bb_teams to the cloud for signed-in users.
   localStorage stays the app's read path; the server is a per-team
   last-write-wins mirror keyed on updatedAt. Signed-out users are untouched.
   Fires `bb:sync-status` on document: {state: 'syncing'|'synced'|'error'}. */
(function () {
  'use strict';

  const KEY  = 'bb_teams';
  const TOMB = 'bb_deleted_teams'; // ids deleted locally, pending server delete

  let _serverMeta = null; // Map id -> {updatedAt} from last reconcile
  let _pushTimer  = null;
  let _busy       = false;

  function _status(state) {
    document.dispatchEvent(new CustomEvent('bb:sync-status', { detail: { state } }));
  }
  function _getLocal() {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
  }
  function _setLocal(teams) { localStorage.setItem(KEY, JSON.stringify(teams)); }
  function _getTombs() {
    try { return JSON.parse(localStorage.getItem(TOMB) ?? '[]'); } catch { return []; }
  }

  function _dataUrlToBlob(dataUrl) {
    const [head, b64] = dataUrl.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: mime });
  }

  /* Replace any dataURL photos on a team with uploaded R2 photo URLs. */
  async function _migratePhotos(team) {
    let changed = false;
    for (const p of team.players ?? []) {
      if (typeof p.photo === 'string' && p.photo.startsWith('data:')) {
        const up = await BBApi.uploadPhoto(_dataUrlToBlob(p.photo));
        p.photoId = up.id;
        p.photo = up.url;
        changed = true;
      }
    }
    if (changed) _setLocal(_getLocal().map((t) => (t.id === team.id ? team : t)));
  }

  /* A team may only be pushed by the account it was last synced under.
     Unsynced local teams (no _syncOwner) are adopted by whoever signs in. */
  function _pushableBy(team, userId) {
    return !team._syncOwner || team._syncOwner === userId;
  }

  function _applyServerTeam(team) {
    const merged = team.data;
    merged.id = team.id;
    merged.updatedAt = team.updatedAt;
    merged.isPublic = team.isPublic;
    merged._syncOwner = BBApi.user?.id;
    const all = _getLocal();
    const idx = all.findIndex((t) => t.id === team.id);
    if (idx >= 0) all[idx] = merged; else all.push(merged);
    _setLocal(all);
  }

  async function _pushTeam(team) {
    await _migratePhotos(team);
    team._syncOwner = BBApi.user?.id;
    const body = {
      name: team.name || 'Unnamed Team',
      baseTeamId: team.baseTeamId || 'custom',
      isPublic: !!team.isPublic,
      updatedAt: team.updatedAt || Date.now(),
      baseUpdatedAt: _serverMeta?.get(team.id)?.updatedAt ?? null,
      data: team,
    };
    try {
      await BBApi.putTeam(team.id, body);
      _serverMeta?.set(team.id, { updatedAt: body.updatedAt });
      _setLocal(_getLocal().map((t) => (t.id === team.id ? team : t)));
    } catch (e) {
      if (e.status === 403) {
        // Owned by a different account (shared device) — leave it alone.
        console.warn('[team-sync] skipping team not owned by this account:', team.name);
      } else if (e.status === 409) {
        // Server copy is newer (edited on another device) — it wins.
        const { team: server } = await BBApi.getTeam(team.id);
        _applyServerTeam(server);
        _serverMeta?.set(team.id, { updatedAt: server.updatedAt });
      } else {
        throw e;
      }
    }
  }

  async function _deletePending() {
    const tombs = _getTombs();
    if (!tombs.length) return;
    for (const id of tombs) {
      try { await BBApi.deleteTeam(id); } catch (e) { if (e.status !== 404) throw e; }
      _serverMeta?.delete(id);
    }
    localStorage.removeItem(TOMB);
  }

  /* Full two-way reconcile: run at page load / login. */
  async function reconcile() {
    if (!window.BBApi?.user || _busy) return;
    _busy = true;
    _status('syncing');
    try {
      await _deletePending();
      const { teams: server } = await BBApi.listTeams();
      _serverMeta = new Map(server.map((t) => [t.id, { updatedAt: t.updatedAt, isPublic: t.isPublic }]));

      // Pull: server teams that are newer than (or missing from) local.
      const localMap = new Map(_getLocal().map((t) => [t.id, t]));
      for (const s of server) {
        const l = localMap.get(s.id);
        if (!l || s.updatedAt > (l.updatedAt || 0)) {
          const { team } = await BBApi.getTeam(s.id);
          _applyServerTeam(team);
        }
      }
      // Push: local teams that are newer than (or missing from) the server.
      for (const l of _getLocal()) {
        if (!_pushableBy(l, BBApi.user.id)) continue;
        const s = _serverMeta.get(l.id);
        if (!s || (l.updatedAt || 0) > s.updatedAt) await _pushTeam(l);
      }
      _status('synced');
    } catch (e) {
      console.warn('[team-sync] reconcile failed:', e);
      _status('error');
    } finally {
      _busy = false;
    }
  }

  /* Debounced incremental push after local edits. */
  async function _pushChanged() {
    if (!window.BBApi?.user || !_serverMeta || _busy) return;
    _busy = true;
    _status('syncing');
    try {
      await _deletePending();
      for (const l of _getLocal()) {
        if (!_pushableBy(l, BBApi.user.id)) continue;
        const s = _serverMeta.get(l.id);
        if (!s || (l.updatedAt || 0) > s.updatedAt) await _pushTeam(l);
      }
      _status('synced');
    } catch (e) {
      console.warn('[team-sync] push failed:', e);
      _status('error');
    } finally {
      _busy = false;
    }
  }

  document.addEventListener('bb:teams-changed', () => {
    if (!window.BBApi?.user) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(_pushChanged, 2000);
  });

  document.addEventListener('bb:auth-changed', (e) => {
    if (e.detail.user) reconcile();
    else _serverMeta = null;
  });

  document.addEventListener('DOMContentLoaded', () => {
    BBApi.me(); // resolves auth state; bb:auth-changed triggers reconcile
  });

  window.BBTeamSync = {
    reconcile,
    canUpload() { return !!window.BBApi?.user; },
    async uploadPhotoFromDataUrl(dataUrl) { return BBApi.uploadPhoto(_dataUrlToBlob(dataUrl)); },
  };
})();
