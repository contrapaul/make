/* BBApi — thin wrapper around the /api backend (accounts, cloud teams, photos).
   Fires `bb:auth-changed` on document whenever the signed-in user changes.
   BBApi.user: undefined = not yet checked, null = signed out, object = signed in. */
(function () {
  'use strict';

  let _user; // undefined until me() resolves

  async function req(method, path, body, isBinary) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      if (isBinary) {
        opts.body = body;
        opts.headers['Content-Type'] = 'image/jpeg';
      } else {
        opts.body = JSON.stringify(body);
        opts.headers['Content-Type'] = 'application/json';
      }
    }
    const res = await fetch(path, opts);
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
    BBApi.user = u;
    if (changed) document.dispatchEvent(new CustomEvent('bb:auth-changed', { detail: { user: u } }));
  }

  const BBApi = {
    user: undefined,

    async me() {
      try {
        const d = await req('GET', '/api/auth/me');
        _setUser(d.user);
        return d.user;
      } catch {
        _setUser(null); // offline or API unreachable — behave as signed out
        return null;
      }
    },
    async signup(email, username, password) {
      const d = await req('POST', '/api/auth/signup', { email, username, password });
      _setUser(d.user);
      return d.user;
    },
    async login(email, password) {
      const d = await req('POST', '/api/auth/login', { email, password });
      _setUser(d.user);
      return d.user;
    },
    async logout() {
      await req('POST', '/api/auth/logout', {});
      _setUser(null);
    },
    verifyEmail(token)              { return req('POST', '/api/auth/verify-email', { token }); },
    requestReset(email)             { return req('POST', '/api/auth/request-reset', { email }); },
    resetPassword(token, newPassword) { return req('POST', '/api/auth/reset-password', { token, newPassword }); },

    listTeams()        { return req('GET', '/api/teams'); },
    getTeam(id)        { return req('GET', '/api/teams/' + id); },
    putTeam(id, body)  { return req('PUT', '/api/teams/' + id, body); },
    deleteTeam(id)     { return req('DELETE', '/api/teams/' + id); },

    publicTeams(params) { return req('GET', '/api/public/teams?' + new URLSearchParams(params)); },
    publicTeam(id)      { return req('GET', '/api/public/teams/' + id); },

    uploadPhoto(blob)  { return req('POST', '/api/photos', blob, true); },
    deletePhoto(id)    { return req('DELETE', '/api/photos/' + id); },
  };

  window.BBApi = BBApi;
})();
