/* Soundboard UI — account (sign in / out) via the shared /api/auth endpoints. */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var api = root.SBApi;
  var D = S.dom;
  var make = D.make, section = D.section;

  // Calls into sibling modules, resolved at call time so load order is free.
  function render() { S.ui.render(); }
  function lcdMsg(t) { S.ui.lcdMsg(t); }
  function lcdError(t) { S.ui.lcdError(t); }

  function accountSection() {
    if (api && api.user) {
      var out = make('button', { type: 'button', class: 'sb-btn sb-btn--warn', text: 'Sign out', onclick: function () {
        api.logout().then(function () { model.clearBuffers(); model.reset(); render(); lcdMsg('Signed out \u00b7 local mode'); });
      }});
      return section('Account', [
        make('p', { class: 'sb-hint', text: 'Signed in as ' + (api.user.username || api.user.email || 'you') + ' \u00b7 boards save to the cloud.' }),
        make('div', { class: 'sb-row' }, [out]),
      ]);
    }
    var email = make('input', { class: 'sb-input', type: 'email', placeholder: 'email', 'aria-label': 'Email' });
    var pass = make('input', { class: 'sb-input', type: 'password', placeholder: 'password', 'aria-label': 'Password' });
    var signIn = make('button', { type: 'button', class: 'sb-btn', text: 'Sign in', onclick: function () {
      if (!email.value || !pass.value) { lcdError('Enter email and password'); return; }
      api.login(email.value, pass.value)
        .then(function () { render(); lcdMsg('Signed in \u00b7 cloud mode'); })
        .catch(function (e) { lcdError((e && e.message) || 'Sign in failed'); });
    }});
    return section('Account', [
      make('p', { class: 'sb-hint', text: 'Sign in (same account as the rest of the site) to save boards and sounds to the cloud.' }),
      make('div', { class: 'sb-field' }, [make('label', { text: 'Email' }), email]),
      make('div', { class: 'sb-field' }, [make('label', { text: 'Password' }), pass]),
      make('div', { class: 'sb-row' }, [signIn]),
    ]);
  }

  root.SoundBoard.account = { accountSection: accountSection };
})(typeof self !== 'undefined' ? self : this);
