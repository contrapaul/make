'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/spp-tracker.js
   SPP event logging, post-game screen, level-up modal.
   ═══════════════════════════════════════════════════════ */

const SPPTracker = (() => {

  /* ── Constants ── */

  const THRESHOLDS = [6, 16, 31, 51, 76];

  const SPP_AMOUNTS = {
    td:      3,   /* touchdown scorer */
    pass:    1,   /* completing a pass that leads to TD */
    catch:   1,   /* catching a TD-scoring pass */
    cas:     2,   /* causing a casualty */
    ko:      1,   /* causing a KO */
    intercept: 2, /* making an interception */
  };

  /* Skill categories available for level-up (exclude Traits) */
  const LEARNABLE_CATS = [
    'General Skill', 'Agility Skill', 'Passing Skill',
    'Strength Skill', 'Mutation',
  ];

  /* ── Utilities ── */

  function h(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function levelsEarned(totalSPP) {
    return THRESHOLDS.filter(t => totalSPP >= t).length;
  }

  /* ── SPP event logging ── */

  function awardSPP(side, playerIdx, amount, reason) {
    const gs      = window.GameState;
    const players = window.getPlayerList?.(side) ?? [];
    const p       = players[playerIdx];
    if (!p) return;

    gs.sppEvents.push({
      side,
      playerIdx,
      savedId:    p.savedId ?? null,
      playerName: p.name,
      amount,
      reason,
      timestamp:  Date.now(),
    });

    _showToast(`+${amount} SPP — ${p.name} (${reason})`);
  }

  /* ═══════════════════════════════════════════════════════
     PLAYER PICKER MODAL
     ═══════════════════════════════════════════════════════ */

  function _showPlayerPicker({ title, subtitle, side, filterFn, onSelect, onSkip }) {
    _removeModal('spp-backdrop', 'spp-modal');

    const players = (window.getPlayerList?.(side) ?? [])
      .filter(filterFn ?? (() => true));

    const bd = document.createElement('div');
    bd.className = 'spp-backdrop'; bd.id = 'spp-backdrop';

    const modal = document.createElement('div');
    modal.className = 'spp-modal'; modal.id = 'spp-modal';

    const titleEl = document.createElement('div');
    titleEl.className   = 'spp-modal-title';
    titleEl.textContent = title;
    modal.appendChild(titleEl);

    if (subtitle) {
      const sub = document.createElement('div');
      sub.className   = 'spp-modal-sub';
      sub.textContent = subtitle;
      modal.appendChild(sub);
    }

    if (players.length === 0) {
      const note = document.createElement('p');
      note.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.7rem;color:rgba(160,190,255,0.45);margin:0;';
      note.textContent   = 'No eligible players on this roster.';
      modal.appendChild(note);
    }

    const list = document.createElement('div');
    list.className = 'spp-player-list';

    players.forEach(p => {
      const btn = document.createElement('button');
      btn.type      = 'button';
      btn.className = 'spp-player-btn';
      btn.innerHTML = `
        <span>${h(p.name)}</span>
        <span class="spp-player-pos">${h(p.pos)}</span>
      `;
      btn.addEventListener('click', () => {
        bd.remove(); modal.remove();
        onSelect(p);
      });
      list.appendChild(btn);
    });
    modal.appendChild(list);

    /* Skip / cancel */
    const skip = document.createElement('button');
    skip.type      = 'button';
    skip.className = 'spp-modal-skip';
    skip.textContent = onSkip ? 'Skip' : 'Cancel';
    skip.addEventListener('click', () => {
      bd.remove(); modal.remove();
      onSkip?.();
    });
    modal.appendChild(skip);

    bd.addEventListener('click', () => { bd.remove(); modal.remove(); onSkip?.(); });
    document.body.appendChild(bd);
    document.body.appendChild(modal);
  }

  function _removeModal(...ids) {
    ids.forEach(id => document.getElementById(id)?.remove());
  }

  /* ═══════════════════════════════════════════════════════
     TD SCORING PROMPT
     ═══════════════════════════════════════════════════════ */

  function openTDPrompt(side) {
    const PS = window.PlayerStatus;
    const eligible = p =>
      p.status === PS?.AVAILABLE || p.status === PS?.PRONE || p.status === PS?.STUNNED;

    _showPlayerPicker({
      title:    '🏆 Who scored the TD?',
      subtitle: `+${SPP_AMOUNTS.td} SPP for the scorer`,
      side,
      filterFn: eligible,
      onSelect(scorer) {
        awardSPP(side, scorer.idx, SPP_AMOUNTS.td, 'Touchdown');

        /* Optional: was there a pass? */
        _showPlayerPicker({
          title:    'Was there a pass? (+1 SPP)',
          subtitle: 'Select passer — or skip if no pass action',
          side,
          filterFn: eligible,
          onSelect(passer) {
            if (passer.idx !== scorer.idx) {
              awardSPP(side, passer.idx, SPP_AMOUNTS.pass, 'TD Pass');
            }
            /* Optional: catcher */
            _showPlayerPicker({
              title:    'Who caught the pass? (+1 SPP)',
              subtitle: 'Select catcher — or skip',
              side,
              filterFn: p => eligible(p) && p.idx !== passer.idx,
              onSelect(catcher) {
                if (catcher.idx !== scorer.idx) {
                  awardSPP(side, catcher.idx, SPP_AMOUNTS.catch, 'TD Catch');
                }
              },
              onSkip() {},
            });
          },
          onSkip() {},
        });
      },
      onSkip() {},
    });
  }

  /* ═══════════════════════════════════════════════════════
     INJURY SPP PROMPT
     side = team that caused the injury (not the victim)
     type = 'cas' | 'ko'
     ═══════════════════════════════════════════════════════ */

  function openInjuryPrompt(injurerSide, type) {
    const amount  = SPP_AMOUNTS[type] ?? 0;
    const reason  = type === 'cas' ? 'Casualty' : 'KO';
    const PS      = window.PlayerStatus;
    const eligible = p =>
      p.status === PS?.AVAILABLE || p.status === PS?.PRONE || p.status === PS?.STUNNED;

    _showPlayerPicker({
      title:    `⚡ Who caused the ${reason}? (+${amount} SPP)`,
      subtitle: `Tap the injuring player`,
      side:     injurerSide,
      filterFn: eligible,
      onSelect(p) {
        awardSPP(injurerSide, p.idx, amount, reason);
      },
      onSkip() {},
    });
  }

  /* ═══════════════════════════════════════════════════════
     POST-GAME SCREEN
     ═══════════════════════════════════════════════════════ */

  function showPostGame() {
    let overlay = document.getElementById('postgame-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'postgame-overlay';
      overlay.id        = 'postgame-overlay';
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    _buildPostGameContent(overlay);
  }

  function _buildPostGameContent(overlay) {
    overlay.innerHTML = '';
    const gs = window.GameState;
    const scores = window.gbState?.scores ?? { home: 0, away: 0 };

    const container = document.createElement('div');
    container.className = 'postgame-container';
    overlay.appendChild(container);

    /* Close button */
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'position:absolute;top:1rem;right:1rem;background:transparent;border:none;color:rgba(160,200,255,0.5);cursor:pointer;font-size:1.3rem;line-height:1;';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => { overlay.hidden = true; });
    overlay.appendChild(closeBtn);

    /* Score */
    const header = document.createElement('div');
    header.className = 'postgame-header';
    header.innerHTML = `
      <div class="postgame-score">Home ${gs.scores?.home ?? 0} – ${gs.scores?.away ?? 0} Away</div>
      <div class="postgame-label">Final Score</div>
    `;
    container.appendChild(header);

    /* SPP Events */
    if (gs.sppEvents.length > 0) {
      const sec = _pgSection('Star Player Points');
      container.appendChild(sec);

      /* Aggregate by player */
      const agg = {};
      gs.sppEvents.forEach(ev => {
        const key = `${ev.side}-${ev.playerIdx}`;
        if (!agg[key]) agg[key] = { name: ev.playerName, side: ev.side, playerIdx: ev.playerIdx, savedId: ev.savedId, total: 0, events: [] };
        agg[key].total    += ev.amount;
        agg[key].events.push(ev);
      });

      Object.values(agg).forEach(entry => {
        const row = document.createElement('div');
        row.className = 'spp-event-row';
        row.innerHTML = `
          <span class="spp-event-name">${h(entry.name)}</span>
          <span class="spp-event-reason">${entry.events.map(e => e.reason).join(', ')}</span>
          <span class="spp-event-amount">+${entry.total}</span>
        `;
        sec.appendChild(row);
      });
    }

    /* Injuries (non-available players) */
    const injuredPlayers = [];
    ['left', 'right'].forEach(side => {
      const players = window.getPlayerList?.(side) ?? [];
      players.forEach(p => {
        const status = p.status;
        if (status && status !== window.PlayerStatus?.AVAILABLE && status !== window.PlayerStatus?.TEMP_NEG) {
          injuredPlayers.push({ ...p, side });
        }
      });
    });

    if (injuredPlayers.length > 0) {
      const sec = _pgSection('Injuries');
      container.appendChild(sec);

      injuredPlayers.forEach(p => {
        const meta = window.STATUS_META?.[p.status];
        const cls  = p.status === 'dead' ? 'dead'
                   : (p.status === 'badly_hurt' || p.status === 'mng') ? 'mng'
                   : 'ko';
        const row  = document.createElement('div');
        row.className = 'postgame-inj-row';
        row.innerHTML = `
          <span class="postgame-inj-name">${h(p.name)}</span>
          <span class="postgame-inj-status ${cls}">${h(meta?.label ?? p.status)}</span>
          <span style="font-family:JetBrains Mono,monospace;font-size:0.6rem;color:rgba(130,160,210,0.4);">${p.side === 'left' ? 'Home' : 'Away'}</span>
        `;
        sec.appendChild(row);
      });
    }

    /* Save to My Teams section */
    const hasHomeTeam = !!gs.activeTeamIds?.home;
    const hasAwayTeam = !!gs.activeTeamIds?.away;

    if (hasHomeTeam || hasAwayTeam) {
      const sec = _pgSection('Save to My Teams');
      container.appendChild(sec);

      const note = document.createElement('p');
      note.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.7rem;color:rgba(160,195,255,0.5);margin:0 0 0.5rem;';
      note.textContent   = 'Apply SPP, injuries, and level-ups to your saved team records.';
      sec.appendChild(note);

      const saveBtn = document.createElement('button');
      saveBtn.type      = 'button';
      saveBtn.className = 'roll-btn';
      saveBtn.style.cssText = 'width:100%;';
      saveBtn.innerHTML = '<span class="roll-btn-icon">💾</span> Save & Level Up';
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        await _saveToTeams();
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.color = '#81c784';
        setTimeout(() => { overlay.hidden = true; }, 1200);
      });
      sec.appendChild(saveBtn);
    } else {
      const note = document.createElement('p');
      note.style.cssText = 'font-family:JetBrains Mono,monospace;font-size:0.7rem;color:rgba(130,160,210,0.35);';
      note.textContent   = 'Load teams from My Teams to enable league record saving.';
      container.appendChild(note);
    }

    /* Export current SPP log */
    if (gs.sppEvents.length > 0) {
      const expBtn = document.createElement('button');
      expBtn.type      = 'button';
      expBtn.className = 'pass-nav-btn';
      expBtn.style.cssText = 'width:100%;margin-top:0.5rem;';
      expBtn.textContent = '⬇ Export SPP Log (JSON)';
      expBtn.addEventListener('click', () => {
        const data = { score: gs.scores, sppEvents: gs.sppEvents, timestamp: Date.now() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = `bb_game_${Date.now()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      });
      container.appendChild(expBtn);
    }
  }

  function _pgSection(title) {
    const sec = document.createElement('div');
    sec.className = 'postgame-section';
    const t = document.createElement('div');
    t.className   = 'postgame-section-title';
    t.textContent = title;
    sec.appendChild(t);
    return sec;
  }

  /* ═══════════════════════════════════════════════════════
     SAVE TO MY TEAMS + LEVEL-UP
     ═══════════════════════════════════════════════════════ */

  let _levelUpQueue = [];

  async function _saveToTeams() {
    const gs = window.GameState;
    _levelUpQueue = [];

    /* Process each side that has an active saved team */
    for (const gbSide of ['home', 'away']) {
      const teamId = gs.activeTeamIds?.[gbSide];
      if (!teamId) continue;

      const team = window.TeamBuilder?.getTeam(teamId);
      if (!team) continue;

      const side = gbSide === 'home' ? 'left' : 'right';

      /* Apply SPP events */
      const sideEvents = gs.sppEvents.filter(e => e.side === side && e.savedId);
      sideEvents.forEach(ev => {
        const player = team.players.find(p => p.id === ev.savedId);
        if (!player) return;
        const prevLevel = levelsEarned(player.spp);
        player.spp = (player.spp ?? 0) + ev.amount;
        const newLevel  = levelsEarned(player.spp);
        if (newLevel > prevLevel) {
          /* Queue level-up */
          for (let i = prevLevel; i < newLevel; i++) {
            _levelUpQueue.push({ teamId, playerId: player.id, playerName: player.name, spp: player.spp, teamName: team.name });
          }
        }
      });

      /* Apply injuries from current game statuses */
      const livePlayers = window.getPlayerList?.(side) ?? [];
      livePlayers.forEach(lp => {
        if (!lp.savedId) return;
        const player = team.players.find(p => p.id === lp.savedId);
        if (!player) return;
        const PS = window.PlayerStatus;
        switch (lp.status) {
          case PS?.BADLY_HURT:
          case PS?.MNG:
            player.missingNextGame = true; break;
          case PS?.DEAD:
            player.dead = true; break;
          /* KO clears when team saves — they either recovered or not */
          default: break;
        }
      });

      window.TeamBuilder?.saveTeam(team);
    }

    /* Run level-up queue sequentially */
    for (const entry of _levelUpQueue) {
      await _showLevelUp(entry);
    }
  }

  function _showLevelUp({ teamId, playerId, playerName, spp, teamName }) {
    return new Promise(resolve => {
      /* Remove any prior level-up modal */
      document.getElementById('levelup-backdrop')?.remove();
      document.getElementById('levelup-modal')?.remove();

      const skills = (window.BBSkillsList ?? []).filter(s => LEARNABLE_CATS.includes(s.category));
      const grouped = {};
      skills.forEach(s => {
        (grouped[s.category] ??= []).push(s);
      });

      const bd = document.createElement('div');
      bd.className = 'levelup-backdrop'; bd.id = 'levelup-backdrop';

      const modal = document.createElement('div');
      modal.className = 'levelup-modal'; modal.id = 'levelup-modal';

      modal.innerHTML = `
        <div class="levelup-header">
          <div class="levelup-star">⭐</div>
          <div class="levelup-name">${h(playerName)}</div>
          <div class="levelup-spp">${spp} SPP — Level Up!</div>
        </div>
        <div class="levelup-desc">Select a new skill for this player. This will be saved to <strong>${h(teamName)}</strong>.</div>
      `;

      function pickSkill(skillName) {
        /* Apply to saved team */
        const team = window.TeamBuilder?.getTeam(teamId);
        if (team) {
          const player = team.players.find(p => p.id === playerId);
          if (player) {
            player.learnedSkills = player.learnedSkills ?? [];
            player.learnedSkills.push(skillName);
            /* Update skills string for display */
            const base = (player.skills ?? '').trim();
            player.skills = base ? `${base}, ${skillName}` : skillName;
            window.TeamBuilder.saveTeam(team);
          }
        }
        _showToast(`✓ ${playerName} learned ${skillName}!`);
        bd.remove(); modal.remove();
        resolve();
      }

      /* Random skill option */
      const randBtn = document.createElement('button');
      randBtn.type      = 'button';
      randBtn.className = 'skill-btn skill-btn-random';
      randBtn.innerHTML = `
        <span class="skill-btn-name">🎲 Random (D6×D6)</span>
        <span class="skill-btn-desc">Roll a random skill from the General Skill category</span>
      `;
      randBtn.addEventListener('click', () => {
        const genSkills = skills.filter(s => s.category === 'General Skill');
        if (genSkills.length === 0) return;
        const roll1 = Math.floor(Math.random() * 6) + 1;
        const roll2 = Math.floor(Math.random() * 6) + 1;
        /* Use the combined roll as an index (1-based, wrap around) */
        const idx   = ((roll1 - 1) * 6 + (roll2 - 1)) % genSkills.length;
        pickSkill(genSkills[idx].name);
      });
      modal.appendChild(randBtn);

      /* Skill list grouped by category */
      Object.entries(grouped).forEach(([cat, catSkills]) => {
        const catLabel = document.createElement('div');
        catLabel.className   = 'skill-cat-label';
        catLabel.textContent = cat;
        modal.appendChild(catLabel);

        catSkills.forEach(skill => {
          const btn = document.createElement('button');
          btn.type      = 'button';
          btn.className = 'skill-btn';
          btn.innerHTML = `
            <span class="skill-btn-name">${h(skill.name)}</span>
            <span class="skill-btn-desc">${h(skill.description?.slice(0, 100) ?? '')}${(skill.description?.length ?? 0) > 100 ? '…' : ''}</span>
          `;
          btn.addEventListener('click', () => pickSkill(skill.name));
          modal.appendChild(btn);
        });
      });

      document.body.appendChild(bd);
      document.body.appendChild(modal);
    });
  }

  /* ── Toast ── */

  let _toastTimer = null;

  function _showToast(msg) {
    let el = document.getElementById('spp-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'spp-toast';
      el.style.cssText = `
        position:fixed; bottom:2rem; left:50%; transform:translateX(-50%);
        z-index:900; background:rgba(4,10,30,0.95);
        border:1px solid rgba(212,175,55,0.35); border-radius:6px;
        padding:0.4rem 0.9rem; font-family:'JetBrains Mono',monospace;
        font-size:0.72rem; font-weight:700; color:var(--bb-gold,#D4AF37);
        white-space:nowrap; pointer-events:none;
        box-shadow:0 3px 14px rgba(0,0,0,0.4); transition:opacity 0.35s;
      `;
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2800);
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC SURFACE
     ══════════════════════════════════════════════════════ */

  return {
    openTDPrompt,
    openInjuryPrompt,
    showPostGame,
    awardSPP,
  };

})();

window.SPPTracker = SPPTracker;
