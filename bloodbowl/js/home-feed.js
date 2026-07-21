/* Alternative home page: chronological activity feed merging public teams,
   tournaments, finished games, and tournament photo posts. Read-only,
   no sign-in required — this page has no game-engine scripts loaded.

   Loads 15 items at a time via "Load more"; each of the four sources is
   fetched page-by-page (?page=) and merged+re-sorted so "Load more" stays
   correctly chronological across sources, not just within one. The whole
   pool (items fetched so far + pagination cursors) is cached in
   sessionStorage for a couple of minutes so navigating away and back
   doesn't re-fetch everything from scratch. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const PAGE_SIZE = 15;
  const CACHE_KEY = 'bb:homeFeedCache:v1';
  const CACHE_TTL_MS = 2 * 60 * 1000;

  const SOURCES = ['teams', 'tournaments', 'games', 'photos'];
  let pool = [];                 // all items fetched so far, sorted newest-first
  let shown = 0;                 // how many of `pool` are currently rendered
  let srcPage = { teams: 0, tournaments: 0, games: 0, photos: 0 };
  let srcHasMore = { teams: true, tournaments: true, games: true, photos: true };

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

  /* Fetch one page from each source that still has more, tag + return new items. */
  async function fetchNextBatch() {
    const jobs = [];
    if (srcHasMore.teams)       jobs.push(safeFetch(`/api/public/teams?page=${srcPage.teams}`).then((r) => {
      (r?.teams ?? []).forEach((t) => pool.push({
        timestamp: t.updatedAt, icon: '🛡️',
        html: `<a href="../coach/?u=${encodeURIComponent(t.owner)}">${esc(t.owner)}</a> shared <b>${esc(t.name)}</b> (${esc(t.baseTeamId)})`,
        href: `../browse/?team=${t.id}`,
      }));
      srcHasMore.teams = !!r?.hasMore; srcPage.teams++;
    }));
    if (srcHasMore.tournaments) jobs.push(safeFetch(`/api/tournaments?page=${srcPage.tournaments}`).then((r) => {
      (r?.tournaments ?? []).forEach((t) => pool.push({
        timestamp: t.createdAt, icon: '🏆',
        html: `<a href="../coach/?u=${encodeURIComponent(t.owner)}">${esc(t.owner)}</a> started a tournament: <b>${esc(t.name)}</b>`,
        href: `../tournaments/?t=${t.id}`,
      }));
      srcHasMore.tournaments = !!r?.hasMore; srcPage.tournaments++;
    }));
    if (srcHasMore.games)       jobs.push(safeFetch(`/api/games?page=${srcPage.games}`).then((r) => {
      (r?.games ?? []).forEach((g) => pool.push({
        timestamp: g.finishedAt, icon: '🎲',
        html: `<b>${esc(g.homeTeam || 'Home')}</b> ${g.homeScore}–${g.awayScore} <b>${esc(g.awayTeam || 'Away')}</b> — ${esc(g.host)} vs ${esc(g.guest || '?')}`,
        href: `../coach/?u=${encodeURIComponent(g.host)}`,
      }));
      srcHasMore.games = !!r?.hasMore; srcPage.games++;
    }));
    if (srcHasMore.photos)      jobs.push(safeFetch(`/api/feed/photos?page=${srcPage.photos}`).then((r) => {
      (r?.posts ?? []).forEach((p) => pool.push({
        timestamp: p.createdAt, thumb: p.photoUrl,
        html: `<a href="../coach/?u=${encodeURIComponent(p.coach)}">${esc(p.coach)}</a> posted a photo${p.tournamentName ? ` to <b>${esc(p.tournamentName)}</b>` : ''}${p.caption ? ` — “${esc(p.caption)}”` : ''}`,
        href: `../tournaments/?t=${p.tournamentId}`,
      }));
      srcHasMore.photos = !!r?.hasMore; srcPage.photos++;
    }));
    await Promise.all(jobs);
    pool.sort((a, b) => b.timestamp - a.timestamp);
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

  function anySourceHasMore() {
    return SOURCES.some((s) => srcHasMore[s]);
  }

  function render() {
    const list = $('hf-feed-list');
    const loadMoreBtn = $('hf-load-more');
    list.innerHTML = '';
    if (!pool.length) {
      list.innerHTML = '<p class="acct-hint">No activity yet — public teams, tournaments, games, and photos will show up here as coaches create them.</p>';
      loadMoreBtn.hidden = true;
      return;
    }
    pool.slice(0, shown).forEach((it) => {
      list.appendChild(feedRow({ icon: it.icon, thumb: it.thumb, html: it.html, when: timeAgo(it.timestamp), href: it.href }));
    });
    loadMoreBtn.hidden = shown >= pool.length && !anySourceHasMore();
  }

  function saveCache() {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), pool, shown, srcPage, srcHasMore }));
    } catch { /* storage full/unavailable — feed still works, just re-fetches next time */ }
  }

  function loadCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      const c = JSON.parse(raw);
      if (!c || Date.now() - c.savedAt > CACHE_TTL_MS) return false;
      pool = c.pool; shown = c.shown; srcPage = c.srcPage; srcHasMore = c.srcHasMore;
      return true;
    } catch {
      return false;
    }
  }

  async function loadMore() {
    const btn = $('hf-load-more');
    btn.disabled = true;
    btn.textContent = 'Loading…';
    /* Top up the pool if what's buffered won't cover the next page. */
    while (pool.length - shown < PAGE_SIZE && anySourceHasMore()) {
      await fetchNextBatch();
    }
    shown = Math.min(pool.length, shown + PAGE_SIZE);
    render();
    saveCache();
    btn.disabled = false;
    btn.textContent = 'Load more';
  }

  async function init() {
    if (loadCache()) {
      render();
      return;
    }
    await fetchNextBatch();
    shown = Math.min(pool.length, PAGE_SIZE);
    render();
    saveCache();
  }

  /* ── Join Game dialog (self-contained — same pattern as the live
     homepage's Join Game button, no game-engine dependency needed). ── */
  function openJoinDialog() {
    const back = document.createElement('div');
    back.className = 'hf-dialog-back';
    const box = document.createElement('div');
    box.className = 'hf-dialog';
    box.innerHTML = '<h2 class="acct-h2">Join a Game</h2>' +
      '<p class="acct-hint" style="margin:0;">Enter the 6-character code from your opponent\'s invite.</p>';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'hf-dialog-field';
    inp.maxLength = 6; inp.placeholder = 'GAME CODE';
    inp.style.textTransform = 'uppercase';
    inp.autocapitalize = 'characters'; inp.spellcheck = false;
    box.appendChild(inp);
    const row = document.createElement('div');
    row.className = 'hf-dialog-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'acct-btn acct-btn-ghost'; cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'acct-btn'; ok.textContent = 'Join Game';
    row.appendChild(cancel); row.appendChild(ok);
    box.appendChild(row);
    const close = () => back.remove();
    const join = () => {
      const code = inp.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) { inp.classList.add('hf-dialog-field--bad'); inp.focus(); return; }
      location.href = '../join/?code=' + code;
    };
    cancel.addEventListener('click', close);
    ok.addEventListener('click', join);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
      if (e.key === 'Escape') close();
    });
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.appendChild(box);
    document.body.appendChild(back);
    inp.focus();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('hf-load-more')?.addEventListener('click', loadMore);
    $('hf-join-game-btn')?.addEventListener('click', openJoinDialog);
    init().catch(() => {
      $('hf-feed-list').innerHTML = '<p class="acct-hint">Could not load the activity feed.</p>';
      $('hf-load-more').hidden = true;
    });
  });
})();
