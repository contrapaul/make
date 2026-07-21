/* Alternative home page: chronological activity feed merging public teams,
   tournaments, finished games, and tournament photo posts. Read-only,
   no sign-in required — this page has no game-engine scripts loaded. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function timeAgo(ms) {
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function safeFetch(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function feedRow({ icon, thumb, html, when, href }) {
    const row = document.createElement(href ? 'a' : 'div');
    if (href) row.href = href;
    row.className = 'hf-feed-item';
    row.innerHTML = `
      ${thumb ? `<img class="hf-feed-thumb" src="${thumb}" alt="">` : `<span class="hf-feed-icon" aria-hidden="true">${icon}</span>`}
      <div class="hf-feed-main">
        <div class="hf-feed-text">${html}</div>
        <div class="hf-feed-when">${when}</div>
      </div>`;
    return row;
  }

  async function loadFeed() {
    const list = $('hf-feed-list');
    const [teamsRes, tourneysRes, gamesRes, photosRes] = await Promise.all([
      safeFetch('/api/public/teams'),
      safeFetch('/api/tournaments'),
      safeFetch('/api/games'),
      safeFetch('/api/feed/photos'),
    ]);

    const items = [];
    (teamsRes?.teams ?? []).forEach((t) => items.push({
      timestamp: t.updatedAt, icon: '🛡️',
      html: `<a href="../coach/?u=${encodeURIComponent(t.owner)}">${esc(t.owner)}</a> shared <b>${esc(t.name)}</b> (${esc(t.baseTeamId)})`,
      href: `../browse/?team=${t.id}`,
    }));
    (tourneysRes?.tournaments ?? []).forEach((t) => items.push({
      timestamp: t.createdAt, icon: '🏆',
      html: `<a href="../coach/?u=${encodeURIComponent(t.owner)}">${esc(t.owner)}</a> started a tournament: <b>${esc(t.name)}</b>`,
      href: `../tournaments/?t=${t.id}`,
    }));
    (gamesRes?.games ?? []).forEach((g) => items.push({
      timestamp: g.finishedAt, icon: '🎲',
      html: `<b>${esc(g.homeTeam || 'Home')}</b> ${g.homeScore}–${g.awayScore} <b>${esc(g.awayTeam || 'Away')}</b> — ${esc(g.host)} vs ${esc(g.guest || '?')}`,
      href: `../coach/?u=${encodeURIComponent(g.host)}`,
    }));
    (photosRes?.posts ?? []).forEach((p) => items.push({
      timestamp: p.createdAt, thumb: p.photoUrl,
      html: `<a href="../coach/?u=${encodeURIComponent(p.coach)}">${esc(p.coach)}</a> posted a photo${p.tournamentName ? ` to <b>${esc(p.tournamentName)}</b>` : ''}${p.caption ? ` — “${esc(p.caption)}”` : ''}`,
      href: `../tournaments/?t=${p.tournamentId}`,
    }));

    items.sort((a, b) => b.timestamp - a.timestamp);

    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<p class="acct-hint">No activity yet — public teams, tournaments, games, and photos will show up here as coaches create them.</p>';
      return;
    }
    items.slice(0, 15).forEach((it) => {
      list.appendChild(feedRow({ icon: it.icon, thumb: it.thumb, html: it.html, when: timeAgo(it.timestamp), href: it.href }));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadFeed().catch(() => {
      $('hf-feed-list').innerHTML = '<p class="acct-hint">Could not load the activity feed.</p>';
    });
  });
})();
