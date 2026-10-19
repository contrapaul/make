/* SBApi — soundboard client wrapper over the shared /api backend.
   Reuses the Bloodbowl auth endpoints (same bb_session cookie). Credentials are
   same-origin so the cookie is sent automatically. Fires `sb:auth-changed` on
   document whenever the signed-in user changes.
   SBApi.user: undefined = not yet checked, null = signed out, object = signed in. */
(function () {
  'use strict';

  let _user; // undefined until me() resolves

  async function req(method, path, body, opts) {
    opts = opts || {};
    const headers = {};
    const init = { method, headers, credentials: 'same-origin' };
    if (body !== undefined) {
      if (opts.raw) {
        init.body = body;
        if (opts.contentType) headers['Content-Type'] = opts.contentType;
        if (opts.name) headers['X-Sound-Name'] = opts.name;
      } else {
        init.body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
      }
    }
    const res = await fetch(path, init);
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function _setUser(u) {
    const changed = JSON.stringify(_user ?? null) !== JSON.stringify(u ?? null);
    _user = u;
    SBApi.user = u;
    if (changed) document.dispatchEvent(new CustomEvent('sb:auth-changed', { detail: { user: u } }));
  }

  const SBApi = {
    user: undefined,
    request: req,

    // --- auth (shared with Bloodbowl) -------------------------------------
    async me() {
      try { const d = await req('GET', '/api/auth/me'); _setUser(d.user); return d.user; }
      catch { _setUser(null); return null; }
    },
    async login(email, password) { const d = await req('POST', '/api/auth/login', { email, password }); _setUser(d.user); return d.user; },
    async signup(email, username, password) { const d = await req('POST', '/api/auth/signup', { email, username, password }); _setUser(d.user); return d.user; },
    async logout() { await req('POST', '/api/auth/logout', {}); _setUser(null); },

    // --- sounds ------------------------------------------------------------
    uploadSound(blob, name, mime) { return req('POST', '/api/sounds', blob, { raw: true, contentType: mime, name }); },
    soundUrl(id) { return '/api/sounds/' + id; },
    deleteSound(id) { return req('DELETE', '/api/sounds/' + id); },

    // --- soundboards -------------------------------------------------------
    listBoards() { return req('GET', '/api/soundboards'); },
    createBoard() { return req('POST', '/api/soundboards'); },
    getBoard(id) { return req('GET', '/api/soundboards/' + id); },
    putBoard(id, body) { return req('PUT', '/api/soundboards/' + id, body); },
    deleteBoard(id) { return req('DELETE', '/api/soundboards/' + id); },

    // --- public boards (signed-out playback of a shared board) -------------
    loadPublicBoard(id) { return req('GET', '/api/public/soundboards/' + id); },
  };

  window.SBApi = SBApi;
})();
