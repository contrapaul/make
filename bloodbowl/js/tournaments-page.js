/* Tournaments page: public list + create (list view), and the full
   tournament room (detail view, ?t=<id>): coaches, organizer-paired
   rounds, standings, and the photo wall. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tid = new URLSearchParams(location.search).get('t');

  let user = null;      // BBApi user (or null)
  let data = null;      // detail payload {tournament, entries, matches, standings}
  let photoBlob = null; // pending wall upload

  function banner(msg, isError) {
    const el = $('tv-banner');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }
  const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const STATUS_LABEL = { open: 'Registration open', active: 'In progress', done: 'Finished' };

  /* ═══ LIST VIEW ═══ */

  async function showList() {
    $('tv-list').hidden = false;
    if (!user) {
      $('tv-create-hint').textContent = 'Sign in (Account page) to run a tournament.';
      $('tv-create-form').hidden = true;
    } else if (!user.emailVerified) {
      $('tv-create-hint').textContent = 'Verify your email (Account page) to run a tournament.';
      $('tv-create-form').hidden = true;
    }

    $('tv-create-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        const { id } = await BBApi.request('POST', '/api/tournaments', {
          name: $('tv-new-name').value,
          description: $('tv-new-desc').value,
        });
        location.href = `?t=${id}`;
      } catch (e) { banner(e.message, true); }
    });

    const box = $('tv-rows');
    try {
      const { tournaments } = await BBApi.request('GET', '/api/tournaments');
      if (!tournaments.length) {
        box.innerHTML = '<p class="acct-hint">No tournaments yet — start the first one!</p>';
        return;
      }
      box.innerHTML = '';
      for (const t of tournaments) {
        const a = document.createElement('a');
        a.className = 'tv-row';
        a.href = `?t=${t.id}`;
        a.innerHTML = `
          <span class="tv-row-name">${esc(t.name)}</span>
          <span class="tv-status tv-status--${t.status}">${STATUS_LABEL[t.status] || t.status}</span>
          <span class="tv-row-meta">${t.coaches} coach${t.coaches === 1 ? '' : 'es'} · run by ${esc(t.owner)} · ${fmtDate(t.createdAt)}</span>`;
        box.appendChild(a);
      }
    } catch (e) {
      box.textContent = 'Could not load tournaments: ' + e.message;
    }
  }

  /* ═══ DETAIL VIEW ═══ */

  const amOrganizer   = () => user && data && data.tournament.ownerId === user.id;
  const amParticipant = () => user && data && data.entries.some((e) => e.userId === user.id);

  async function refresh() {
    data = await BBApi.request('GET', `/api/tournaments/${tid}`);
    renderHeader();
    renderEntries();
    renderRounds();
    renderStandings();
  }

  function renderHeader() {
    const t = data.tournament;
    $('tv-name').textContent = t.name;
    $('tv-owner').textContent = t.owner;
    $('tv-desc').textContent = t.description;
    const st = $('tv-status');
    st.textContent = STATUS_LABEL[t.status];
    st.className = `tv-status tv-status--${t.status}`;

    const org = $('tv-org-controls');
    org.hidden = !amOrganizer();
    if (amOrganizer()) {
      const btn = $('tv-status-btn');
      btn.hidden = t.status === 'done';
      btn.textContent = t.status === 'open' ? '▶ Start Tournament (close registration)' : '🏁 Finish Tournament';
      btn.onclick = async () => {
        try {
          await BBApi.request('PUT', `/api/tournaments/${tid}`, { status: t.status === 'open' ? 'active' : 'done' });
          refresh();
        } catch (e) { banner(e.message, true); }
      };
      $('tv-delete-btn').onclick = async () => {
        if (!confirm('Delete this tournament? Entries, results, and the photo wall go with it.')) return;
        try {
          await BBApi.request('DELETE', `/api/tournaments/${tid}`);
          location.href = './';
        } catch (e) { banner(e.message, true); }
      };
    }
  }

  function renderEntries() {
    const t = data.tournament;
    $('tv-coach-count').textContent = `(${data.entries.length})`;
    const box = $('tv-entries');
    box.innerHTML = data.entries.length ? '' : '<p class="acct-hint">No coaches yet.</p>';
    for (const e of data.entries) {
      const row = document.createElement('div');
      row.className = 'acct-team-row';
      row.innerHTML = `
        <span class="acct-team-name">${esc(e.coach)}</span>
        <span class="acct-team-race">${esc(e.teamName)}${e.baseTeamId ? ' · ' + esc(e.baseTeamId) : ''}</span>`;
      if (amOrganizer() && e.userId !== user.id) {
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'tv-remove';
        rm.textContent = '✕';
        rm.title = 'Remove coach';
        rm.onclick = async () => {
          if (!confirm(`Remove ${e.coach} from the tournament?`)) return;
          try { await BBApi.request('DELETE', `/api/tournaments/${tid}/entries/${e.userId}`); refresh(); }
          catch (err) { banner(err.message, true); }
        };
        row.appendChild(rm);
      }
      box.appendChild(row);
    }

    const joinBox = $('tv-join-box');
    const hint = $('tv-join-hint');
    joinBox.hidden = true;
    $('tv-leave-btn').hidden = true;
    hint.hidden = true;
    if (t.status === 'open') {
      if (!user) {
        hint.textContent = 'Sign in (Account page) to enter this tournament.';
        hint.hidden = false;
      } else if (amParticipant()) {
        $('tv-leave-btn').hidden = false;
        $('tv-leave-btn').onclick = async () => {
          try { await BBApi.request('DELETE', `/api/tournaments/${tid}/join`); refresh(); }
          catch (e) { banner(e.message, true); }
        };
      } else {
        joinBox.hidden = false;
        loadMyTeamsInto($('tv-join-team'));
        $('tv-join-btn').onclick = async () => {
          const teamId = $('tv-join-team').value;
          if (!teamId) { banner('Pick a team first.', true); return; }
          try { await BBApi.request('POST', `/api/tournaments/${tid}/join`, { teamId }); refresh(); }
          catch (e) { banner(e.message, true); }
        };
      }
    }
  }

  async function loadMyTeamsInto(sel) {
    sel.innerHTML = '<option value="">Loading teams…</option>';
    try {
      const { teams } = await BBApi.listTeams();
      sel.innerHTML = teams.length ? '' : '<option value="">No cloud teams — build one first</option>';
      for (const t of teams) {
        const o = document.createElement('option');
        o.value = t.id;
        o.textContent = `${t.name} (${t.baseTeamId})`;
        sel.appendChild(o);
      }
    } catch { sel.innerHTML = '<option value="">Could not load teams</option>'; }
  }

  function renderRounds() {
    const box = $('tv-rounds');
    box.innerHTML = data.matches.length ? '' : '<p class="acct-hint">No pairings yet.</p>';
    const rounds = new Map();
    for (const m of data.matches) {
      if (!rounds.has(m.round)) rounds.set(m.round, []);
      rounds.get(m.round).push(m);
    }
    for (const [round, matches] of [...rounds.entries()].sort((a, b) => a[0] - b[0])) {
      const h = document.createElement('h3');
      h.className = 'tv-h3';
      h.textContent = `Round ${round}`;
      box.appendChild(h);
      for (const m of matches) box.appendChild(matchRow(m));
    }

    const pairing = $('tv-pairing');
    pairing.hidden = !amOrganizer() || data.tournament.status === 'done';
    if (!pairing.hidden) {
      const maxRound = Math.max(0, ...data.matches.map((m) => m.round));
      $('tv-pair-round').value = data.matches.some((m) => m.round === maxRound && m.homeScore === null && m.awayUserId !== null)
        ? Math.max(1, maxRound) : maxRound + 1;
      const opts = data.entries.map((e) => `<option value="${e.userId}">${esc(e.coach)}</option>`).join('');
      $('tv-pair-home').innerHTML = opts;
      $('tv-pair-away').innerHTML = opts + '<option value="">— BYE —</option>';
      $('tv-pair-add').onclick = async () => {
        try {
          await BBApi.request('POST', `/api/tournaments/${tid}/matches`, {
            round: parseInt($('tv-pair-round').value, 10) || 1,
            homeUserId: $('tv-pair-home').value,
            awayUserId: $('tv-pair-away').value || null,
          });
          refresh();
        } catch (e) { banner(e.message, true); }
      };
    }
  }

  function matchRow(m) {
    const row = document.createElement('div');
    row.className = 'tv-match';
    if (m.awayUserId === null) {
      row.innerHTML = `<span class="tv-match-names">${esc(m.homeCoach)} — <em>bye</em></span><span class="tv-match-done">W</span>`;
    } else {
      const canReport = user && (amOrganizer() || m.homeUserId === user.id || m.awayUserId === user.id);
      const reported = m.homeScore !== null;
      row.innerHTML = `<span class="tv-match-names">${esc(m.homeCoach)} <em>vs</em> ${esc(m.awayCoach)}</span>`;
      if (canReport && data.tournament.status !== 'done') {
        const hs = document.createElement('input');
        const as = document.createElement('input');
        [hs, as].forEach((i) => { i.type = 'number'; i.min = 0; i.max = 99; i.className = 'tv-score'; });
        hs.value = reported ? m.homeScore : '';
        as.value = reported ? m.awayScore : '';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'acct-btn tv-save';
        save.textContent = reported ? 'Fix' : 'Save';
        save.onclick = async () => {
          try {
            await BBApi.request('PUT', `/api/tournaments/${tid}/matches/${m.id}`, { homeScore: hs.value, awayScore: as.value });
            refresh();
          } catch (e) { banner(e.message, true); }
        };
        row.append(hs, document.createTextNode('–'), as, save);
      } else {
        row.innerHTML += `<span class="tv-match-done">${reported ? `${m.homeScore} – ${m.awayScore}` : 'not played'}</span>`;
      }
      if (amOrganizer() && data.tournament.status !== 'done') {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'tv-remove';
        del.textContent = '✕';
        del.title = 'Delete pairing';
        del.onclick = async () => {
          try { await BBApi.request('DELETE', `/api/tournaments/${tid}/matches/${m.id}`); refresh(); }
          catch (e) { banner(e.message, true); }
        };
        row.appendChild(del);
      }
    }
    return row;
  }

  function renderStandings() {
    const tbody = $('tv-standings').querySelector('tbody');
    tbody.innerHTML = '';
    data.standings.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${esc(s.coach)}</td><td>${esc(s.team)}</td>
        <td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td>
        <td>${s.tdFor - s.tdAgainst >= 0 ? '+' : ''}${s.tdFor - s.tdAgainst}</td><td><strong>${s.points}</strong></td>`;
      tbody.appendChild(tr);
    });
  }

  /* ═══ PHOTO WALL ═══ */

  function downscale(file, maxEdge = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
      img.src = url;
    });
  }

  async function renderWall() {
    const canPost = amOrganizer() || amParticipant();
    $('tv-composer').hidden = !canPost;
    $('tv-wall-hint').hidden = canPost;

    const wall = $('tv-wall');
    try {
      const { posts } = await BBApi.request('GET', `/api/tournaments/${tid}/posts`);
      wall.innerHTML = posts.length ? '' : '<p class="acct-hint">No photos yet — be the first!</p>';
      for (const p of posts) {
        const card = document.createElement('figure');
        card.className = 'tv-post';
        card.innerHTML = `
          <img src="${p.photoUrl}" alt="" loading="lazy">
          <figcaption>
            <span class="tv-post-caption">${esc(p.caption)}</span>
            <span class="tv-post-meta">${esc(p.coach)} · ${fmtDate(p.createdAt)}</span>
          </figcaption>`;
        if (user && (p.userId === user.id || amOrganizer())) {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'tv-remove tv-post-del';
          del.textContent = '✕';
          del.title = 'Delete post';
          del.onclick = async () => {
            if (!confirm('Delete this photo from the wall?')) return;
            try { await BBApi.request('DELETE', `/api/tournaments/${tid}/posts/${p.id}`); renderWall(); }
            catch (e) { banner(e.message, true); }
          };
          card.appendChild(del);
        }
        wall.appendChild(card);
      }
    } catch (e) {
      wall.textContent = 'Could not load the wall: ' + e.message;
    }
  }

  function wireComposer() {
    $('tv-photo-pick').addEventListener('click', () => $('tv-photo-file').click());
    $('tv-photo-file').addEventListener('change', async () => {
      const file = $('tv-photo-file').files?.[0];
      $('tv-photo-file').value = '';
      if (!file) return;
      try {
        photoBlob = await downscale(file);
        const thumb = $('tv-photo-thumb');
        thumb.src = URL.createObjectURL(photoBlob);
        thumb.hidden = false;
        $('tv-photo-share').disabled = false;
      } catch (e) { banner(e.message, true); }
    });
    $('tv-photo-share').addEventListener('click', async () => {
      if (!photoBlob) return;
      const btn = $('tv-photo-share');
      btn.disabled = true;
      btn.textContent = 'Sharing…';
      try {
        const { id: photoId } = await BBApi.uploadPhoto(photoBlob);
        await BBApi.request('POST', `/api/tournaments/${tid}/posts`, { photoId, caption: $('tv-photo-caption').value });
        photoBlob = null;
        $('tv-photo-thumb').hidden = true;
        $('tv-photo-caption').value = '';
        renderWall();
      } catch (e) { banner(e.message, true); }
      btn.disabled = false;
      btn.textContent = 'Share to Wall';
    });
  }

  /* ═══ BOOT ═══ */

  document.addEventListener('DOMContentLoaded', async () => {
    user = await BBApi.me();
    if (!tid) { showList(); return; }
    $('tv-detail').hidden = false;
    wireComposer();
    try {
      await refresh();
      renderWall();
    } catch (e) {
      $('tv-name').textContent = 'Tournament not found';
      $('tv-desc').textContent = e.message;
    }
  });
})();
