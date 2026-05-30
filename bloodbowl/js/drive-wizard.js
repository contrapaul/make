'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/drive-wizard.js
   Step-through wizard for drive setup and teardown.

   Flows:
     'half-start'  — Weather → Kicking → Prayers → Setup
                     → Deviation → Kickoff → Ready
     'drive-only'  — Setup → Deviation → Kickoff → Ready
     'drive-end'   — Effects → KO Recovery
   ═══════════════════════════════════════════════════════ */

const DriveWizard = (() => {

  /* ── Flow definitions ── */
  const FLOWS = {
    'half-start': ['weather', 'kicking', 'prayers', 'setup', 'deviation', 'kickoff', 'ready'],
    'drive-only': ['setup', 'deviation', 'kickoff', 'ready'],
    'drive-end':  ['effects', 'ko-recovery'],
  };

  const STEP_LABELS = {
    weather:       '🌤 Weather',
    kicking:       '⚽ Kicking Team',
    prayers:       '✦ Prayers',
    setup:         '📋 Setup',
    deviation:     '⬡ Kick Deviation',
    kickoff:       '⚡ Kickoff Event',
    ready:         '▸ Drive Ready',
    effects:       '🔔 Drive Effects',
    'ko-recovery': '💊 KO Recovery',
  };

  /* ── Internal state ── */
  let _flow  = [];
  let _step  = 0;
  let _state = {};  /* { weather, kickingTeam, prayer, deviation, kickoff } */

  /* ── Next-button lock (for roll-required steps) ── */
  function _lockNext() {
    const btn = document.getElementById('dw-next');
    if (btn) { btn.disabled = true; btn.title = 'Roll first to continue'; }
  }
  function _unlockNext() {
    const btn = document.getElementById('dw-next');
    if (btn) { btn.disabled = false; btn.title = ''; }
  }

  /* ── Utilities ── */
  function h(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function mkDie(id, sides = 6) {
    const el = document.createElement('div');
    el.className = 'die';
    el.id        = id;
    el.dataset.value = '1';
    if (sides !== 6) el.dataset.sides = sides;
    el.innerHTML = `<div class="die-face${sides >= 8 ? ' d8-face' : ''}"></div>`;
    return el;
  }

  function isPhys() {
    return (window.BBSettings?.getSettings().diceMode ?? 'digital') === 'physical';
  }

  /* ── Public API ── */

  function open(flow = 'half-start') {
    _flow  = FLOWS[flow] ?? FLOWS['half-start'];
    _step  = 0;
    _state = {};
    _wireNav();
    _render();
    _showModal();
  }

  function close() {
    _hideModal();
  }

  function minimise() {
    const el = document.getElementById('drive-wizard');
    if (el) el.hidden = true;
    const pill = document.getElementById('dw-pill');
    if (pill) { pill.hidden = false; _updatePill(); }
  }

  function restore() {
    const el   = document.getElementById('drive-wizard');
    const pill = document.getElementById('dw-pill');
    if (el)   el.hidden   = false;
    if (pill) pill.hidden = true;
  }

  /* ── Internal ── */

  function _showModal() {
    const el = document.getElementById('drive-wizard');
    if (el) el.hidden = false;
    document.getElementById('dw-backdrop')?.classList.add('active');
  }

  function _hideModal() {
    const el   = document.getElementById('drive-wizard');
    const pill = document.getElementById('dw-pill');
    if (el)   el.hidden   = true;
    if (pill) pill.hidden = true;
    document.getElementById('dw-backdrop')?.classList.remove('active');
  }

  function _updatePill() {
    const el = document.getElementById('dw-pill-step');
    if (el) el.textContent = `${_step + 1}/${_flow.length}`;
  }

  function _wireNav() {
    const backBtn = document.getElementById('dw-back');
    const nextBtn = document.getElementById('dw-next');
    const minBtn  = document.getElementById('dw-minimise');
    const pill    = document.getElementById('dw-pill');
    const bd      = document.getElementById('dw-backdrop');

    if (backBtn) backBtn.onclick = () => _go(-1);
    if (nextBtn) nextBtn.onclick = () => {
      if (_step >= _flow.length - 1) close();
      else _go(1);
    };
    if (minBtn) minBtn.onclick = minimise;
    if (pill)   pill.onclick   = restore;

    /* Backdrop closes wizard unless Beginner mode (cannot skip) */
    if (bd) {
      bd.onclick = () => {
        const mode = window.BBSettings?.getSettings().mode ?? 'veteran';
        if (mode !== 'beginner') close();
      };
    }
  }

  function _go(dir) {
    const n = _step + dir;
    if (n < 0 || n >= _flow.length) return;
    _step = n;
    _render();
  }

  function _render() {
    const step = _flow[_step];

    /* ── Step dots ── */
    const dotsEl = document.getElementById('dw-step-dots');
    if (dotsEl) {
      dotsEl.innerHTML = '';
      _flow.forEach((s, i) => {
        const dot = document.createElement('div');
        dot.className = 'dw-dot';
        if (i < _step)   dot.classList.add('dw-dot-done');
        if (i === _step) dot.classList.add('dw-dot-current');
        dot.title = STEP_LABELS[s] ?? s;
        dotsEl.appendChild(dot);
      });
    }

    /* ── Nav buttons ── */
    const backBtn = document.getElementById('dw-back');
    const nextBtn = document.getElementById('dw-next');
    const isLast  = _step >= _flow.length - 1;
    if (backBtn) backBtn.disabled = _step === 0;
    if (nextBtn) {
      nextBtn.textContent = isLast ? '▸ Play the Drive' : 'Next →';
      nextBtn.disabled    = false;
    }

    _updatePill();

    /* ── Step content ── */
    const contentEl = document.getElementById('dw-content');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className   = 'dw-step-title';
    titleEl.textContent = STEP_LABELS[step] ?? step;
    contentEl.appendChild(titleEl);

    const key = step.replace(/-/g, '_');
    if (STEPS[key]) STEPS[key](contentEl);
  }

  /* ─────────────────────────────────────────────────────
     STEP RENDERERS
     ──────────────────────────────────────────────────── */

  const STEPS = {

    /* ── WEATHER ── */
    weather(el) {
      const cur = window.GameState?.currentWeather;
      if (cur) {
        const curEl = document.createElement('p');
        curEl.className = 'panel-intro';
        curEl.style.marginBottom = '0.4rem';
        curEl.innerHTML = `Current: ${h(cur.emoji)} <strong>${h(cur.name)}</strong>`;
        el.appendChild(curEl);
      } else {
        const intro = document.createElement('p');
        intro.className = 'panel-intro';
        intro.textContent = 'Roll 2D6 to determine weather conditions for this half.';
        el.appendChild(intro);
      }

      const resultEl = document.createElement('div');
      resultEl.className = 'roll-result'; resultEl.hidden = true;

      if (!isPhys()) {
        const d1El = mkDie('dw-wth-d1'); const d2El = mkDie('dw-wth-d2');
        const tray = document.createElement('div');
        tray.className = 'dice-tray'; tray.appendChild(d1El); tray.appendChild(d2El);
        el.appendChild(tray);

        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'roll-btn';
        btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Weather (2D6)';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
          _applyWeather(total, resultEl, d1, d2);
          btn.disabled = false;
        });
        el.appendChild(btn);
      } else {
        const zone = document.createElement('div'); zone.className = 'physical-zone';
        const data = window.BBData?.weather ?? [];
        window.PhysicalDice.showPhysicalButtons(zone, {
          columns: 4,
          buttons: Array.from({ length: 11 }, (_, i) => {
            const t = i + 2;
            const w = data.find(e => t >= e.rollMin && t <= e.rollMax);
            return { value: t, label: w ? `${w.emoji} ${w.name}` : '?',
                     cls: w && w.effect && w.effect !== 'No effect' ? 'phys-warn' : 'phys-neutral' };
          }),
          onSelect: t => _applyWeather(t, resultEl),
        });
        el.appendChild(zone);
      }
      el.appendChild(resultEl);
      _lockNext();
    },

    /* ── KICKING TEAM ── */
    kicking(el) {
      const note = document.createElement('p');
      note.className = 'panel-intro';
      note.textContent = 'Which team is kicking off this drive?';
      el.appendChild(note);

      const resultEl = document.createElement('div');
      resultEl.className = 'roll-result'; resultEl.hidden = true;

      function setKicker(key) {
        const label = key === 'home' ? 'Home' : 'Away';
        sel.querySelectorAll('.dw-team-btn').forEach(b => b.classList.toggle('active', b.dataset.team === key));
        _state.kickingTeam = key;
        if (window.GameState) window.GameState.kickingTeam = key;
        resultEl.innerHTML = `<div class="result-name">⚽ ${h(label)} team kicks off!</div>`;
        resultEl.hidden = false;
      }

      const sel = document.createElement('div'); sel.className = 'dw-team-select';
      ['Home', 'Away'].forEach(team => {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'dw-team-btn';
        btn.dataset.team = team.toLowerCase();
        btn.textContent = team === 'Home' ? '🏠 We kick' : '✈️ They kick';
        if (_state.kickingTeam === team.toLowerCase()) btn.classList.add('active');
        btn.addEventListener('click', () => setKicker(team.toLowerCase()));
        sel.appendChild(btn);
      });
      el.appendChild(sel);

      /* Coin flip row */
      const flipRow = document.createElement('div');
      flipRow.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-top:0.6rem;';

      const flipDieEl = mkDie('dw-kick-flip-die');
      flipDieEl.style.cssText = 'width:36px;height:36px;flex-shrink:0;';

      const flipBtn = document.createElement('button');
      flipBtn.type = 'button'; flipBtn.className = 'dmt-btn';
      flipBtn.style.cssText = 'padding:0.3rem 0.85rem;font-size:0.72rem;';
      flipBtn.textContent = '🪙 Coin Flip (D6: 1–3 = Home, 4–6 = Away)';
      flipBtn.addEventListener('click', async () => {
        flipBtn.disabled = true;
        const roll = await Dice.rollDieElement(flipDieEl);
        const key = roll <= 3 ? 'home' : 'away';
        setKicker(key);
        /* Auto-advance after 1.5 s */
        setTimeout(() => _go(1), 1500);
      });

      flipRow.appendChild(flipDieEl);
      flipRow.appendChild(flipBtn);
      el.appendChild(flipRow);

      const hint = document.createElement('p');
      hint.className = 'panel-intro';
      hint.style.marginTop = '0.5rem';
      hint.textContent = 'The kicking team places the ball on the pitch. The receiving team receives first.';
      el.appendChild(hint);
      el.appendChild(resultEl);
    },

    /* ── PRAYERS ── */
    prayers(el) {
      const note = document.createElement('p');
      note.className = 'panel-intro';
      note.textContent = 'If a team has fewer players on the pitch than the opposition at kick-off, that team\'s Coach may pray to Nuffle. Roll D16.';
      el.appendChild(note);

      const resultEl = document.createElement('div');
      resultEl.className = 'roll-result'; resultEl.hidden = true;

      if (!isPhys()) {
        const dieEl = mkDie('dw-pr-d1', 16);
        const tray  = document.createElement('div');
        tray.className = 'dice-tray single'; tray.appendChild(dieEl);
        el.appendChild(tray);

        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'roll-btn';
        btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll D16 — Pray to Nuffle';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const val = await Dice.rollDieElement(dieEl);
          _applyPrayer(val, resultEl);
          btn.disabled = false;
        });
        el.appendChild(btn);
      } else {
        const zone = document.createElement('div'); zone.className = 'physical-zone';
        const data = window.BBData?.prayers ?? [];
        window.PhysicalDice.showPhysicalButtons(zone, {
          columns: 4,
          buttons: Array.from({ length: 16 }, (_, i) => {
            const v = i + 1;
            const p = data.find(e => e.roll === v);
            return { value: v, label: p?.name ?? '?' };
          }),
          onSelect: v => _applyPrayer(v, resultEl),
        });
        el.appendChild(zone);
      }

      const skipBtn = document.createElement('button');
      skipBtn.type = 'button'; skipBtn.className = 'dw-nav-btn';
      skipBtn.style.marginTop = '0.45rem';
      skipBtn.textContent = 'Skip — no prayers needed';
      skipBtn.addEventListener('click', () => { _unlockNext(); _go(1); });
      el.appendChild(skipBtn);
      el.appendChild(resultEl);
      _lockNext();
    },

    /* ── SETUP REMINDER ── */
    setup(el) {
      const kicker = _state.kickingTeam ?? window.GameState?.kickingTeam;
      const kickLabel = kicker ? (kicker.charAt(0).toUpperCase() + kicker.slice(1)) + ' team kicking' : 'Kicking team TBD';

      const card = document.createElement('div');
      card.className = 'roll-result';
      card.style.display = 'block';
      card.innerHTML = `
        <div class="result-name" style="margin-bottom:0.4rem;">⚽ ${h(kickLabel)}</div>
        <p class="result-desc">
          Place all your players in their zones. The kicking team must have at least 3 players
          on the line of scrimmage. The receiving team sets up across from them.
          The kicking team places the ball anywhere in their own half.
        </p>
        <p class="result-desc" style="margin-top:0.3rem;opacity:0.65;font-size:0.7rem;">
          Both teams must field at least 3 players. Any player with a Secret Weapon must
          declare it now if they have not already.
        </p>
      `;
      el.appendChild(card);
    },

    /* ── KICK DEVIATION ── */
    deviation(el) {
      const note = document.createElement('p');
      note.className = 'panel-intro';
      note.textContent = 'Roll D6 for distance (squares) and D8 for direction (scatter template).';
      el.appendChild(note);

      const DIR = { 1:'↖ Up-Left',2:'↑ Up',3:'↗ Up-Right',4:'← Left',5:'→ Right',6:'↙ Down-Left',7:'↓ Down',8:'↘ Down-Right' };
      const resultEl = document.createElement('div');
      resultEl.className = 'roll-result'; resultEl.hidden = true;

      if (!isPhys()) {
        const d6El = mkDie('dw-dev-d6');
        const d8El = mkDie('dw-dev-d8', 8);
        const tray = document.createElement('div');
        tray.className = 'dice-tray'; tray.appendChild(d6El); tray.appendChild(d8El);
        el.appendChild(tray);

        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'roll-btn';
        btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Kick Deviation';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const [dist, dir] = await Promise.all([Dice.rollDieElement(d6El), Dice.rollDieElement(d8El)]);
          resultEl.innerHTML = `<div class="result-name">Deviates ${dist} square${dist !== 1 ? 's' : ''}</div><div class="result-direction">${DIR[dir] ?? dir}</div>`;
          resultEl.hidden = false;
          _state.deviation = { dist, dir };
          _unlockNext();
          btn.disabled = false;
        });
        el.appendChild(btn);
      } else {
        /* Physical: distance first, then compass direction */
        let selDist = null;

        const distLbl = document.createElement('div');
        distLbl.className = 'input-label'; distLbl.style.marginBottom = '0.25rem';
        distLbl.textContent = 'Distance (D6)';
        el.appendChild(distLbl);

        const distZone = document.createElement('div'); distZone.className = 'physical-zone';
        window.PhysicalDice.showPhysicalButtons(distZone, {
          columns: 6,
          buttons: Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: `${i + 1} sq` })),
          onSelect(d) {
            selDist = d;
            dirLblWrap.hidden = false;
            dirZone.hidden    = false;
          },
        });
        el.appendChild(distZone);

        const dirLblWrap = document.createElement('div'); dirLblWrap.hidden = true;
        const dirLbl = document.createElement('div');
        dirLbl.className = 'input-label'; dirLbl.style.margin = '0.5rem 0 0.25rem';
        dirLbl.textContent = 'Direction (D8)';
        dirLblWrap.appendChild(dirLbl);
        el.appendChild(dirLblWrap);

        const dirZone = document.createElement('div'); dirZone.className = 'physical-zone'; dirZone.hidden = true;
        window.PhysicalDice.showCompassButtons(dirZone, dir => {
          resultEl.innerHTML = `<div class="result-name">Deviates ${selDist} square${selDist !== 1 ? 's' : ''}</div><div class="result-direction">${DIR[dir] ?? dir}</div>`;
          resultEl.hidden = false;
          _state.deviation = { dist: selDist, dir };
          _unlockNext();
        });
        el.appendChild(dirZone);
      }
      el.appendChild(resultEl);
      _lockNext();
    },

    /* ── KICKOFF EVENT ── */
    kickoff(el) {
      const note = document.createElement('p');
      note.className = 'panel-intro';
      note.textContent = 'Roll 2D6 for the Kickoff Event table.';
      el.appendChild(note);

      const AFFECTS = { 2:'both',3:'both',4:'kicking',5:'receiving',6:'both',7:'both',8:'both',9:'receiving',10:'kicking',11:'both',12:'both' };
      const resultEl = document.createElement('div');
      resultEl.className = 'roll-result'; resultEl.hidden = true;

      if (!isPhys()) {
        const d1El = mkDie('dw-ko-d1'); const d2El = mkDie('dw-ko-d2');
        const tray = document.createElement('div');
        tray.className = 'dice-tray'; tray.appendChild(d1El); tray.appendChild(d2El);
        el.appendChild(tray);

        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'roll-btn';
        btn.innerHTML = '<span class="roll-btn-icon">🎲</span> Roll Kickoff Event';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const { d1, d2, total } = await Dice.roll2D6(d1El, d2El);
          _applyKickoff(total, resultEl, d1, d2, AFFECTS);
          btn.disabled = false;
        });
        el.appendChild(btn);
      } else {
        const zone = document.createElement('div'); zone.className = 'physical-zone';
        const data = window.BBData?.kickoff ?? [];
        window.PhysicalDice.showPhysicalButtons(zone, {
          columns: 4,
          buttons: Array.from({ length: 11 }, (_, i) => {
            const t = i + 2;
            const ev = data.find(e => e.roll === t);
            return { value: t, label: ev?.name ?? '?' };
          }),
          onSelect: t => _applyKickoff(t, resultEl, null, null, AFFECTS),
        });
        el.appendChild(zone);
      }
      el.appendChild(resultEl);
      _lockNext();
    },

    /* ── DRIVE READY ── */
    ready(el) {
      const w      = window.GameState?.currentWeather;
      const kicker = window.GameState?.kickingTeam ?? _state.kickingTeam;
      const koEv   = _state.kickoff;

      const card = document.createElement('div');
      card.className = 'roll-result';
      card.style.display = 'block';

      let body = `<div class="result-name" style="color:#81c784;font-size:1.05rem;margin-bottom:0.5rem;">✓ Drive Ready!</div>`;

      if (w) {
        const isPerfect = !w.effect || w.effect === 'No effect';
        body += `<div style="margin-bottom:0.3rem;">${isPerfect
          ? `<span class="result-chip result-chip-ok">${h(w.emoji)} ${h(w.name)}</span>`
          : `<span class="result-chip result-chip-warn">⚠ ${h(w.emoji)} ${h(w.name)}: ${h(w.effect)}</span>`}</div>`;
      }
      if (kicker) {
        body += `<div style="font-family:JetBrains Mono,monospace;font-size:0.72rem;color:rgba(200,220,255,0.65);margin-bottom:0.2rem;">⚽ ${h(kicker.charAt(0).toUpperCase() + kicker.slice(1))} team kicking</div>`;
      }
      if (koEv) {
        body += `<div style="font-family:JetBrains Mono,monospace;font-size:0.72rem;color:rgba(200,220,255,0.65);">⚡ ${h(koEv.name)}</div>`;
      }
      body += `<p class="result-desc" style="margin-top:0.4rem;">All pre-drive checks complete. Good luck!</p>`;
      card.innerHTML = body;
      el.appendChild(card);
    },

    /* ── DRIVE EFFECTS (end of drive) ── */
    effects(el) {
      el.innerHTML += '<p class="panel-intro">Resolve any end-of-drive effects before the KO recovery roll.</p>';

      const w = window.GameState?.currentWeather;

      const items = [];
      if (w?.name === 'Sweltering Heat') {
        items.push({ cls: 'result-chip-warn', text: '☀️ Sweltering Heat: each Coach rolls D3. Remove that many random players from the pitch to their Reserves Box.' });
      }
      items.push({ cls: 'result-chip-info', text: '⚠ Secret Weapon check: any player with a Secret Weapon who was on the pitch must roll D6. On a 2+, they are Sent Off (no Argue the Call). On a 1, nothing happens.' });

      items.forEach(item => {
        const div = document.createElement('div');
        div.className = `result-chip ${item.cls}`;
        div.style.cssText = 'display:block;margin-bottom:0.35rem;font-size:0.68rem;white-space:normal;line-height:1.5;padding:0.4rem 0.55rem;';
        div.textContent = item.text;
        el.appendChild(div);
      });
    },

    /* ── KO RECOVERY ── */
    ko_recovery(el) {
      el.innerHTML += '<p class="panel-intro">Each KO\'d player rolls D6. On 4+, they recover and return to the Reserves Box. On 1–3, they remain KO\'d.</p>';

      const allKO = [];
      ['left', 'right'].forEach(side => {
        (window.getPlayerList?.(side) ?? [])
          .filter(p => p.status === window.PlayerStatus?.KO)
          .forEach(p => allKO.push({ ...p, side }));
      });

      if (allKO.length === 0) {
        const note = document.createElement('p');
        note.className = 'panel-intro';
        note.style.color = 'rgba(130, 200, 130, 0.8)';
        note.textContent = 'No KO\'d players — everyone is fit to play!';
        el.appendChild(note);
        return;
      }

      allKO.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'dw-ko-player';

        const name = document.createElement('span');
        name.className = 'dw-ko-name';
        name.textContent = `${p.name} (${p.side === 'left' ? 'Home' : 'Away'})`;
        row.appendChild(name);

        const resultSpan = document.createElement('span');
        resultSpan.className = 'dw-ko-result';
        row.appendChild(resultSpan);

        if (!isPhys()) {
          const dieEl = mkDie(`dw-ko-die-${i}`);
          dieEl.style.cssText = 'width:26px;height:26px;flex-shrink:0;';
          const rollBtn = document.createElement('button');
          rollBtn.type = 'button'; rollBtn.className = 'dmt-btn';
          rollBtn.style.padding = '0.28rem 0.5rem';
          rollBtn.textContent = '🎲';
          rollBtn.addEventListener('click', async () => {
            rollBtn.disabled = true;
            const roll = await Dice.rollDieElement(dieEl);
            _applyKORecovery(p, roll, resultSpan);
          });
          row.appendChild(dieEl);
          row.appendChild(rollBtn);
        } else {
          const miniZone = document.createElement('div');
          miniZone.style.cssText = 'display:flex;gap:0.18rem;flex-shrink:0;';
          [1,2,3,4,5,6].forEach(v => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `phys-btn ${v >= 4 ? 'phys-good' : 'phys-muted'}`;
            btn.style.cssText = 'min-height:1.7rem;padding:0.18rem 0.28rem;';
            btn.innerHTML = `<span class="phys-val" style="font-size:0.75rem;">${v}</span>`;
            btn.addEventListener('click', () => {
              miniZone.querySelectorAll('button').forEach(b => b.disabled = true);
              _applyKORecovery(p, v, resultSpan);
            });
            miniZone.appendChild(btn);
          });
          row.appendChild(miniZone);
        }
        el.appendChild(row);
      });
    },
  };

  /* ─────────────────────────────────────────────────────
     EFFECT HELPERS
     ──────────────────────────────────────────────────── */

  function _applyWeather(total, resultEl, d1, d2) {
    const data = window.BBData?.weather ?? [];
    const w    = data.find(e => total >= e.rollMin && total <= e.rollMax)
              ?? { name: 'Unknown', emoji: '❓', effect: '', desc: '', rollMin: total, rollMax: total };

    /* Store state — but do NOT call refreshWeatherChips/updateGameBarWeather here.
       Those functions can trigger setPhase/updateModuleAvailability which applies
       module-dimmed styles and locks the UI. Defer to after unlock. */
    if (window.GameState) window.GameState.currentWeather = w;

    const isPerfect    = !w.effect || w.effect === 'No effect';
    const breakdownHtml = d1 != null ? `<div class="result-roll-breakdown">${d1} + ${d2}</div>` : '';
    resultEl.innerHTML = `
      <div class="result-roll-num">${total}</div>
      ${breakdownHtml}
      <div class="result-name">${h(w.emoji)} ${h(w.name)}</div>
      ${isPerfect
        ? '<span class="result-chip result-chip-ok">✓ No mechanical effect</span>'
        : `<span class="result-chip result-chip-warn">⚠ ${h(w.effect)}</span>`}
      <p class="result-desc">${h(w.desc)}</p>
    `;
    resultEl.hidden = false;
    _state.weather = w;
    _unlockNext();

    /* Deferred cosmetic updates — safe after unlock */
    setTimeout(() => {
      window.Panels?.refreshWeatherChips?.();
      window.Panels?.updateGameBarWeather?.(w);
    }, 0);
  }

  function _applyPrayer(val, resultEl) {
    const data   = window.BBData?.prayers ?? [];
    const prayer = data.find(e => e.roll === val) ?? { name: 'Unknown Blessing', desc: '' };
    resultEl.innerHTML = `
      <div class="result-roll-num">${val}</div>
      <div class="result-name">✦ ${h(prayer.name)}</div>
      <p class="result-desc">${h(prayer.desc)}</p>
    `;
    resultEl.hidden = false;
    _state.prayer = prayer;
    _unlockNext();
  }

  function _applyKickoff(total, resultEl, d1, d2, AFFECTS) {
    const data = window.BBData?.kickoff ?? [];
    const ev   = data.find(e => e.roll === total) ?? { name: 'Unknown Event', desc: '' };
    const aff  = (AFFECTS ?? {})[total] ?? 'both';
    const chipHtml = aff === 'kicking'
      ? '<span class="result-chip result-chip-warn">⚽ Kicking Team</span>'
      : aff === 'receiving'
      ? '<span class="result-chip result-chip-ok">🏆 Receiving Team</span>'
      : '<span class="result-chip result-chip-info">⚖️ Both Teams</span>';
    const breakdownHtml = d1 != null ? `<div class="result-roll-breakdown">${d1} + ${d2}</div>` : '';

    resultEl.innerHTML = `
      <div class="result-roll-num">${total}</div>
      ${breakdownHtml}
      <div class="result-name">${h(ev.name)}</div>
      ${chipHtml}
      <p class="result-desc">${h(ev.desc)}</p>
    `;
    resultEl.hidden = false;
    _state.kickoff = ev;
    _unlockNext();
  }

  function _applyKORecovery(player, roll, resultSpan) {
    if (roll >= 4) {
      resultSpan.className = 'dw-ko-result ok';
      resultSpan.textContent = `${roll} ✓ Returns!`;
      window.setPlayerStatus?.(player.side, player.idx, window.PlayerStatus?.AVAILABLE);
    } else {
      resultSpan.className = 'dw-ko-result bad';
      resultSpan.textContent = `${roll} ✗ Stays KO`;
    }
  }

  /* Public surface */
  return { open, close, minimise, restore };

})();

window.DriveWizard = DriveWizard;
