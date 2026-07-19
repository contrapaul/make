/* Join page: invited coach joins a live game with one of their cloud teams,
   or anyone spectates. Writes the bb:liveGame session and enters /game. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const code = (new URLSearchParams(location.search).get('code') || '').toUpperCase();
  let meta = null;
  let pickedTeamId = null;

  function banner(msg, isError) {
    const el = $('jn-banner');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
  }

  function enterGame(role) {
    localStorage.setItem('bb:liveGame', JSON.stringify({ code, role, meta }));
    try {
      localStorage.setItem('bb:activeMatch', JSON.stringify({
        v: 1,
        home: { kind: 'live', id: 'live' },
        away: { kind: 'live', id: 'live' },
        gameMode: meta.gameMode,
        createdAt: Date.now(),
      }));
    } catch {}
    location.href = '../game/';
  }

  async function loadTeamsPicker() {
    const box = $('jn-teams');
    box.textContent = 'Loading your teams…';
    const { teams } = await BBApi.listTeams();
    if (!teams.length) {
      box.innerHTML = '<p class="acct-hint">No cloud teams yet — build one in the <a href="../teams/">team builder</a> first (it syncs automatically when you\'re signed in).</p>';
      return;
    }
    box.innerHTML = '';
    for (const t of teams) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'acct-team-row jn-team-row';
      row.innerHTML = '<span class="acct-team-name"></span><span class="acct-team-race"></span>';
      row.querySelector('.acct-team-name').textContent = t.name;
      row.querySelector('.acct-team-race').textContent = t.baseTeamId;
      row.addEventListener('click', () => {
        pickedTeamId = t.id;
        box.querySelectorAll('.jn-team-row').forEach((r) => r.classList.remove('is-picked'));
        row.classList.add('is-picked');
        $('jn-join-btn').disabled = false;
      });
      box.appendChild(row);
    }
  }

  async function join() {
    const btn = $('jn-join-btn');
    btn.disabled = true;
    btn.textContent = 'Joining…';
    try {
      const { team } = await BBApi.getTeam(pickedTeamId);
      const draft = team.data;
      draft.id = team.id;
      const res = await BBApi.request('POST', `/api/live/${code}/join`, {
        guestTeam: { kind: 'custom', id: team.id, draft },
      });
      meta = res.meta;
      enterGame('guest');
    } catch (e) {
      banner(e.message, true);
      btn.disabled = false;
      btn.textContent = 'Join Game';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!code) {
      $('jn-title').textContent = 'No game code';
      $('jn-sub').textContent = 'This page needs an invite link like /join/?code=ABC123.';
      return;
    }
    try {
      const res = await BBApi.request('GET', `/api/live/${code}`);
      meta = res.meta;
    } catch (e) {
      $('jn-title').textContent = 'Game not found';
      $('jn-sub').textContent = 'Double-check the invite link — this code doesn\'t match a game.';
      return;
    }

    $('jn-title').textContent = `Coach ${meta.hostName} challenges you!`;
    $('jn-sub').textContent = `Game ${code} · ${meta.status === 'waiting' ? 'waiting for an opponent' : meta.status === 'active' ? `${meta.hostName} vs ${meta.guestName} — in progress` : 'finished'}`;

    const user = await BBApi.me();

    if (meta.status === 'waiting' || (user && meta.guestName === user.username)) {
      $('jn-join').hidden = false;
      if (!user) {
        $('jn-signin-hint').hidden = false;
        $('jn-signin-link').href = `../account/?return=${encodeURIComponent(location.pathname + location.search)}`;
      } else if (meta.guestName === user.username) {
        // Rejoining a game they already joined (refresh/second visit).
        enterGame('guest');
        return;
      } else {
        $('jn-team-pick').hidden = false;
        $('jn-join-btn').addEventListener('click', join);
        loadTeamsPicker().catch((e) => banner(e.message, true));
      }
    }

    if (meta.status === 'active') {
      $('jn-watch').hidden = false;
      $('jn-watch-btn').addEventListener('click', () => enterGame('spectator'));
    } else if (meta.status === 'waiting') {
      $('jn-watch').hidden = false;
      $('jn-watch-btn').disabled = true;
      $('jn-watch-btn').textContent = 'Watch Live (starts when both coaches are in)';
    }
  });
})();
