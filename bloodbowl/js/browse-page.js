/* Browse page: public team gallery with race filter, search, and a
   read-only roster overlay. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let _raceNames = {}; // baseTeamId -> display name
  let _page = 0;
  let _debounce = null;

  async function loadRaces() {
    try {
      const res = await fetch('../data/teams.json');
      const data = await res.json();
      const sel = $('br-race');
      for (const t of data.teams ?? data) {
        _raceNames[t.id] = t.name;
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        sel.appendChild(opt);
      }
    } catch { /* filter still works as free text ids */ }
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function loadPage() {
    const grid = $('br-grid');
    grid.innerHTML = '<p class="acct-hint">Loading…</p>';
    try {
      const { teams, hasMore } = await BBApi.publicTeams({
        race: $('br-race').value,
        q: $('br-search').value.trim(),
        page: _page,
      });
      grid.innerHTML = '';
      $('br-empty').hidden = teams.length > 0;
      for (const t of teams) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'br-card';
        card.innerHTML =
          `<span class="br-card-name"></span>
           <span class="br-card-race"></span>
           <span class="br-card-meta"></span>`;
        card.querySelector('.br-card-name').textContent = t.name;
        card.querySelector('.br-card-race').textContent = _raceNames[t.baseTeamId] || t.baseTeamId;
        card.querySelector('.br-card-meta').textContent = `Coach ${t.owner} · ${fmtDate(t.updatedAt)}`;
        card.addEventListener('click', () => openDetail(t.id));
        grid.appendChild(card);
      }
      $('br-prev').hidden = _page === 0;
      $('br-next').hidden = !hasMore;
    } catch (e) {
      grid.innerHTML = '';
      $('br-empty').hidden = false;
      $('br-empty').textContent = 'Could not load teams: ' + e.message;
    }
  }

  async function openDetail(id) {
    try {
      const { team } = await BBApi.publicTeam(id);
      $('br-detail-title').textContent = team.name;
      $('br-detail-sub').textContent =
        `${_raceNames[team.baseTeamId] || team.baseTeamId} · Coach ${team.owner} · updated ${fmtDate(team.updatedAt)}`;

      const roster = $('br-roster');
      roster.innerHTML = '';
      const players = team.data.players ?? [];
      if (!players.length) {
        roster.innerHTML = '<p class="acct-hint">No players on this roster.</p>';
      }
      for (const p of players) {
        const row = document.createElement('div');
        row.className = 'br-player';

        if (p.photo && !String(p.photo).startsWith('data:')) {
          const img = document.createElement('img');
          img.className = 'br-player-photo';
          img.src = p.photo;
          img.alt = '';
          row.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'br-player-info';
        const nm = document.createElement('div');
        nm.className = 'br-player-name';
        nm.textContent = `${p.jerseyNumber ? '#' + p.jerseyNumber + ' ' : ''}${p.name || 'Unnamed'}`;
        const pos = document.createElement('div');
        pos.className = 'br-player-pos';
        pos.textContent = p.position || '';
        const stats = document.createElement('div');
        stats.className = 'br-player-stats';
        stats.textContent = `MA ${p.ma ?? '–'} · ST ${p.st ?? '–'} · AG ${p.ag ?? '–'} · PA ${p.pa ?? '–'} · AV ${p.av ?? '–'}`;
        const skills = document.createElement('div');
        skills.className = 'br-player-skills';
        skills.textContent = [p.skills, (p.purchasedSkills ?? []).join(', ')].filter(Boolean).join(', ');
        info.append(nm, pos, stats, skills);
        row.appendChild(info);
        roster.appendChild(row);
      }
      $('br-detail').hidden = false;
    } catch (e) {
      alert(e.message);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    $('br-race').addEventListener('change', () => { _page = 0; loadPage(); });
    $('br-search').addEventListener('input', () => {
      clearTimeout(_debounce);
      _debounce = setTimeout(() => { _page = 0; loadPage(); }, 300);
    });
    $('br-prev').addEventListener('click', () => { _page = Math.max(0, _page - 1); loadPage(); });
    $('br-next').addEventListener('click', () => { _page += 1; loadPage(); });
    $('br-detail-close').addEventListener('click', () => { $('br-detail').hidden = true; });
    $('br-detail').addEventListener('click', (e) => { if (e.target === $('br-detail')) $('br-detail').hidden = true; });

    await loadRaces();
    loadPage();
  });
})();
