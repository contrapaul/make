/* Coach profile: public teams + recent games for ?u=<username>. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  /* Shared with browse-page: one game row with linked coach names. */
  function gameRow(g, highlight) {
    const row = document.createElement('div');
    row.className = 'gm-row';
    const bold = (name) => (highlight && name && name.toLowerCase() === highlight.toLowerCase() ? `<strong>${esc(name)}</strong>` : esc(name || '?'));
    row.innerHTML = `
      <span class="gm-teams">${esc(g.homeTeam || 'Home')} <span class="gm-score">${g.homeScore} – ${g.awayScore}</span> ${esc(g.awayTeam || 'Away')}</span>
      <span class="gm-meta">
        <a href="../coach/?u=${encodeURIComponent(g.host)}">${bold(g.host)}</a> vs
        <a href="../coach/?u=${encodeURIComponent(g.guest || '')}">${bold(g.guest)}</a>
        · ${fmtDate(g.finishedAt)}</span>`;
    return row;
  }
  window.BBGameRow = gameRow;

  document.addEventListener('DOMContentLoaded', async () => {
    const u = new URLSearchParams(location.search).get('u');
    if (!u) { $('ch-name').textContent = 'No coach specified'; return; }
    let data;
    try {
      data = await BBApi.request('GET', '/api/coach/' + encodeURIComponent(u));
    } catch (e) {
      $('ch-name').textContent = 'Coach not found';
      $('ch-meta').textContent = e.message;
      return;
    }

    const { coach, teams, games } = data;
    document.title = `Coach ${coach.username} | Blood Bowl Companion | contrapaul/make`;
    $('ch-title').textContent = `COACH ${coach.username.toUpperCase()}`;
    $('ch-name').textContent = `Coach ${coach.username}`;
    $('ch-meta').textContent = `Joined ${fmtDate(coach.createdAt)}`;

    /* W-D-L from this coach's perspective. */
    let w = 0, d = 0, l = 0;
    for (const g of games) {
      const isHost = g.host.toLowerCase() === coach.username.toLowerCase();
      const mine = isHost ? g.homeScore : g.awayScore;
      const theirs = isHost ? g.awayScore : g.homeScore;
      if (mine > theirs) w++; else if (mine < theirs) l++; else d++;
    }
    $('ch-record').textContent = games.length ? `Record: ${w}W – ${d}D – ${l}L` : '';

    const grid = $('ch-teams');
    $('ch-teams-empty').hidden = teams.length > 0;
    for (const t of teams) {
      const card = document.createElement('a');
      card.className = 'br-card';
      card.href = `../browse/?team=${t.id}`;
      card.innerHTML = `
        <span class="br-card-name">${esc(t.name)}</span>
        <span class="br-card-race">${esc(t.baseTeamId)}</span>
        <span class="br-card-meta">updated ${fmtDate(t.updatedAt)}</span>`;
      grid.appendChild(card);
    }

    const rows = $('ch-games');
    $('ch-games-empty').hidden = games.length > 0;
    for (const g of games) rows.appendChild(gameRow(g, coach.username));
  });
})();
