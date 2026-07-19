/* Account page: sign in / sign up / verify / reset, profile, cloud team list. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  function banner(msg, isError) {
    const el = $('acct-banner');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
  }
  function showError(id, msg) {
    const el = $(id);
    el.textContent = msg;
    el.hidden = false;
  }
  function clearErrors() {
    document.querySelectorAll('.acct-error').forEach((el) => (el.hidden = true));
  }

  function showTab(which) {
    clearErrors();
    $('form-login').hidden = which !== 'login';
    $('form-signup').hidden = which !== 'signup';
    $('form-forgot').hidden = which !== 'forgot';
    $('tab-login').classList.toggle('is-active', which === 'login');
    $('tab-signup').classList.toggle('is-active', which === 'signup');
  }

  function render(user) {
    $('acct-signed-out').hidden = !!user;
    $('acct-signed-in').hidden = !user;
    if (user) {
      $('acct-username').textContent = user.username;
      $('acct-email').textContent = user.email;
      $('acct-verified').textContent = user.emailVerified ? '✓ email verified' : 'email not verified';
      $('acct-verify-hint').hidden = !!user.emailVerified;
      loadTeams();
    }
  }

  async function loadTeams() {
    const box = $('acct-teams');
    box.textContent = 'Loading…';
    try {
      const { teams } = await BBApi.listTeams();
      if (!teams.length) {
        box.innerHTML = '<p class="acct-hint">No cloud teams yet. Build one in the team builder — it syncs automatically.</p>';
        return;
      }
      box.innerHTML = '';
      for (const t of teams) {
        const row = document.createElement('div');
        row.className = 'acct-team-row';

        const name = document.createElement('span');
        name.className = 'acct-team-name';
        name.textContent = t.name;

        const race = document.createElement('span');
        race.className = 'acct-team-race';
        race.textContent = t.baseTeamId;

        const label = document.createElement('label');
        label.className = 'acct-public-toggle';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = t.isPublic;
        cb.addEventListener('change', () => togglePublic(t, cb));
        label.appendChild(cb);
        label.appendChild(document.createTextNode(' Public'));

        row.appendChild(name);
        row.appendChild(race);
        row.appendChild(label);
        box.appendChild(row);
      }
    } catch (e) {
      box.textContent = 'Could not load teams: ' + e.message;
    }
  }

  async function togglePublic(meta, cb) {
    cb.disabled = true;
    try {
      const { team } = await BBApi.getTeam(meta.id);
      const now = Date.now();
      team.data.isPublic = cb.checked;
      team.data.updatedAt = now;
      await BBApi.putTeam(team.id, {
        name: team.name,
        baseTeamId: team.baseTeamId,
        isPublic: cb.checked,
        updatedAt: now,
        baseUpdatedAt: team.updatedAt,
        data: team.data,
      });
      // Keep the local copy in step so sync doesn't see a stale version.
      try {
        const all = JSON.parse(localStorage.getItem('bb_teams') ?? '[]');
        const idx = all.findIndex((x) => x.id === team.id);
        if (idx >= 0) { all[idx].isPublic = cb.checked; all[idx].updatedAt = now; }
        localStorage.setItem('bb_teams', JSON.stringify(all));
      } catch {}
    } catch (e) {
      cb.checked = !cb.checked;
      banner(e.message, true);
    } finally {
      cb.disabled = false;
    }
  }

  async function handleTokenParams() {
    const params = new URLSearchParams(location.search);
    const verify = params.get('verify');
    const reset = params.get('reset');
    if (verify) {
      try {
        await BBApi.verifyEmail(verify);
        banner('✓ Email verified — you can now make teams public.');
      } catch (e) {
        banner(e.message, true);
      }
      history.replaceState(null, '', location.pathname);
    }
    if (reset) {
      $('acct-reset').hidden = false;
      $('acct-signed-out').hidden = true;
      $('form-reset').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        clearErrors();
        try {
          await BBApi.resetPassword(reset, $('reset-password').value);
          $('acct-reset').hidden = true;
          banner('✓ Password updated — sign in with your new password.');
          history.replaceState(null, '', location.pathname);
          render(null);
        } catch (e) {
          showError('reset-error', e.message);
        }
      });
      return true; // suppress normal signed-out render until done
    }
    return false;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('tab-login').addEventListener('click', () => showTab('login'));
    $('tab-signup').addEventListener('click', () => showTab('signup'));
    $('forgot-link').addEventListener('click', () => showTab('forgot'));

    $('form-login').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearErrors();
      try {
        render(await BBApi.login($('login-email').value, $('login-password').value));
      } catch (e) {
        showError('login-error', e.message);
      }
    });

    $('form-signup').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearErrors();
      try {
        const user = await BBApi.signup($('signup-email').value, $('signup-username').value, $('signup-password').value);
        banner('✓ Account created. A verification link is on its way to ' + user.email + '.');
        render(user);
      } catch (e) {
        showError('signup-error', e.message);
      }
    });

    $('form-forgot').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearErrors();
      try {
        await BBApi.requestReset($('forgot-email').value);
        banner('If that email has an account, a reset link is on its way.');
        showTab('login');
      } catch (e) {
        showError('forgot-error', e.message);
      }
    });

    $('btn-logout').addEventListener('click', async () => {
      await BBApi.logout();
      render(null);
    });

    document.addEventListener('bb:sync-status', (e) => {
      const el = $('sync-status');
      if (!el) return;
      el.textContent = { syncing: '☁ syncing…', synced: '☁ synced', error: '☁ sync error — will retry' }[e.detail.state] || '☁';
      if (e.detail.state === 'synced' && !$('acct-signed-in').hidden) loadTeams();
    });

    const suppress = await handleTokenParams();
    const user = await BBApi.me();
    if (!suppress) render(user);
  });
})();
