/* Soundboard UI — account chip in the header (e01s03), via the shared /api/auth
 * endpoints (same login as the rest of the site).
 *
 * Signed out: a "Sign in" pill. Signed in: an initial + username chip. Either opens a
 * small popover anchored under it — not a modal: no backdrop, no focus trap. It closes
 * on Escape, an outside click/tap, clicking the chip again, or a successful sign in/out.
 */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var api = root.SBApi;
  var make = S.dom.make;

  var SIGNUP_URL = '/bloodbowl/account/'; // the site's sign-up page (one login everywhere)

  // Calls into sibling modules, resolved at call time so load order is free.
  function render() { S.ui.render(); }
  function lcdMsg(t) { S.ui.lcdMsg(t); }

  var slot = null;      // #sb-account
  var trigger = null;   // chip / sign-in button
  var popover = null;   // open popover element, or null
  var renderedFor;      // user key the chip was last built for

  function userKey() { return api && api.user ? (api.user.id || api.user.username || 'user') : ''; }

  // Rebuild the chip only when the signed-in user changes, so an open popover
  // survives the app's frequent re-renders.
  function renderAccount() {
    slot = slot || document.getElementById('sb-account');
    if (!slot || !api) return;
    var key = userKey();
    if (trigger && key === renderedFor) return;
    renderedFor = key;
    close(false);
    slot.textContent = '';
    var user = api.user;
    if (user) {
      var name = user.username || user.email || 'you';
      trigger = make('button', { type: 'button', class: 'sb-chip', 'aria-label': 'Account: ' + name }, [
        make('span', { class: 'sb-chip__initial', 'aria-hidden': 'true', text: name.charAt(0).toUpperCase() }),
        make('span', { class: 'sb-chip__name', text: name }),
      ]);
    } else {
      trigger = make('button', { type: 'button', class: 'sb-btn sb-chip--signin', text: 'Sign in' });
    }
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', function () { if (popover) close(true); else open(); });
    slot.appendChild(trigger);
  }

  function open() {
    popover = make('div', { class: 'sb-popover', role: 'dialog', 'aria-label': 'Account' });
    if (api.user) buildSignedIn(popover); else buildSignedOut(popover);
    slot.appendChild(popover);
    trigger.setAttribute('aria-expanded', 'true');
    var first = popover.querySelector('input, button');
    if (first) first.focus();
    // Defer so the click that opened the popover doesn't immediately close it.
    setTimeout(function () {
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
  }

  function close(restoreFocus) {
    if (!popover) return;
    popover.remove();
    popover = null;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }
  }

  function onOutside(e) { if (slot && !slot.contains(e.target)) close(false); }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(true); } }

  function buildSignedOut(box) {
    var email = make('input', { class: 'sb-input', type: 'email', autocomplete: 'email', 'aria-label': 'Email' });
    var pass = make('input', { class: 'sb-input', type: 'password', autocomplete: 'current-password', 'aria-label': 'Password' });
    var err = make('p', { class: 'sb-popover__err', role: 'alert' });
    var btn = make('button', { type: 'submit', class: 'sb-btn sb-btn--primary', text: 'Sign in' });
    var form = make('form', { class: 'sb-popover__form' }, [
      make('div', { class: 'sb-field' }, [make('label', { text: 'Email' }), email]),
      make('div', { class: 'sb-field' }, [make('label', { text: 'Password' }), pass]),
      err,
      btn,
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); // Enter in either field submits
      err.textContent = '';
      if (!email.value || !pass.value) { err.textContent = 'Enter your email and password.'; return; }
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      api.login(email.value, pass.value)
        .then(function () { close(false); render(); lcdMsg('Signed in · boards save to your account'); })
        .catch(function (e2) {
          err.textContent = (e2 && e2.message) || 'Sign in failed.';
          btn.disabled = false;
          btn.textContent = 'Sign in';
          pass.focus();
        });
    });
    box.append(
      make('p', { class: 'sb-popover__title', text: 'Sign in' }),
      make('p', { class: 'sb-hint', text: 'Same account as the rest of the site. Boards and sounds save to it.' }),
      form,
      make('p', { class: 'sb-popover__foot' }, [
        make('span', { text: 'New here? ' }),
        make('a', { href: SIGNUP_URL, text: 'Create an account' }),
      ]),
    );
  }

  function buildSignedIn(box) {
    var name = api.user.username || api.user.email || 'you';
    var who = make('p', { class: 'sb-popover__title' }, [make('span', { text: 'Signed in as ' }), make('strong', { text: name })]);
    var out = make('button', { type: 'button', class: 'sb-btn', text: 'Sign out', onclick: function () {
      out.disabled = true;
      api.logout().then(function () {
        close(false);
        model.clearBuffers(); model.reset(); render();
        lcdMsg('Signed out · local mode');
      });
    }});
    box.append(who, make('p', { class: 'sb-hint', text: 'Boards save to your account.' }), out);
  }

  root.SoundBoard.account = { render: renderAccount, close: close };
})(typeof self !== 'undefined' ? self : this);
