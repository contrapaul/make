// DOM HUD: speed/heading, weapon row with reload bars, 2D-canvas arc radar,
// optional floating damage numbers (pooled DOM labels).
import * as THREE from 'three';
import { speedOf } from '../sim/physics.js';
import { WEAPONS } from '../data/weapons.js';
import { getSettings } from '../settings.js';

const RADAR_RANGE = 200; // world units at the radar rim
const NAMES = { turret: 'TURRET', port: 'PORT', stbd: 'STBD', lance: 'LANCE' };

let labelHost = null; // module singleton (the HUD itself is recreated per game)
function getLabelHost() {
  if (!labelHost) {
    labelHost = document.createElement('div');
    labelHost.className = 'dmg-labels';
    document.body.appendChild(labelHost);
  }
  return labelHost;
}

export function createHud(el, hull, camera) {
  const cells = hull.hardpoints
    .map(
      (hp, i) =>
        `<div class="wcell" id="w-${hp.id}">` +
        `<span class="wk">${i + 1}</span> <span class="wn">${NAMES[hp.id] || hp.id.toUpperCase()}</span>` +
        `<div class="wbar"><i></i></div></div>`
    )
    .join('');
  el.innerHTML =
    '<div>SPD <span class="hud-v">0.0</span> u/s · HDG <span class="hud-h">000</span>°</div>' +
    '<div class="hp"><i></i></div>' +
    '<div id="enemies">ENEMIES 0</div>' +
    '<div id="warn" hidden>⚠ MISSILE INBOUND</div>' +
    `<div class="hud-weapons">${cells}</div>` +
    '<canvas id="radar" width="160" height="160"></canvas>';

  const speedEl = el.querySelector('.hud-v');
  const hdgEl = el.querySelector('.hud-h');
  const hpEl = el.querySelector('.hp i');
  const enemiesEl = el.querySelector('#enemies');
  const warnEl = el.querySelector('#warn');

  const MISSILE_WARN = 250; // units
  const cellEls = {};
  for (const hp of hull.hardpoints) cellEls[hp.id] = el.querySelector(`#w-${hp.id}`);
  const ctx = el.querySelector('#radar').getContext('2d');
  const C = 80; // radar centre (px)

  // Damage numbers: 24 pooled labels, fade over 0.8 s, positioned via camera.
  const labelHost = getLabelHost();
  const labelPool = [];
  for (let i = 0; i < 24; i++) {
    const d = document.createElement('div');
    d.className = 'dmg';
    d.style.display = 'none';
    labelHost.appendChild(d);
    labelPool.push({ el: d, active: false, born: 0, x: 0, z: 0 });
  }
  const tmpV = new THREE.Vector3();
  const FADE = 0.8; // seconds

  const maxCd = (hp) => {
    const wp = WEAPONS[hp.weapon];
    return wp.kind === 'gun' ? 1 / wp.rate : wp.reload;
  };

  // Ship-relative point → radar px. rel 0 = ahead (up), + = port (left).
  const relPoint = (rel, r) => [C - Math.sin(rel) * r, C - Math.cos(rel) * r];

  function drawRadar(state, player) {
    const scale = (C - 4) / RADAR_RANGE;
    ctx.clearRect(0, 0, 160, 160);
    ctx.strokeStyle = 'rgba(90, 110, 160, 0.5)';
    ctx.beginPath();
    ctx.arc(C, C, C - 4, 0, Math.PI * 2);
    ctx.stroke();

    const rArc = 34;
    for (const hp of hull.hardpoints) {
      const sel = player.selected === hp.id;
      const aim = player.mounts[hp.id].aim;
      if (hp.arcHalf >= Math.PI - 1e-6) {
        ctx.strokeStyle = sel ? 'rgba(127,232,255,0.8)' : 'rgba(120,160,255,0.3)';
        ctx.beginPath();
        ctx.arc(C, C, rArc, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = sel ? 'rgba(127,232,255,0.30)' : 'rgba(120,160,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(C, C);
        ctx.arc(C, C, rArc, hp.arcCenter - hp.arcHalf - Math.PI / 2, hp.arcCenter + hp.arcHalf - Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      }
      const [ax, ay] = relPoint(aim, rArc + 6);
      const [bx, by] = relPoint(aim, 10);
      ctx.strokeStyle = sel ? '#7fe8ff' : 'rgba(127,232,255,0.5)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Ship outline, pointing up.
    ctx.fillStyle = '#dbe4ff';
    ctx.beginPath();
    ctx.moveTo(C, C - 8);
    ctx.lineTo(C - 5, C + 6);
    ctx.lineTo(C + 5, C + 6);
    ctx.closePath();
    ctx.fill();

    const dot = (x, z, color, r) => {
      const dx = x - player.x;
      const dz = z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > RADAR_RANGE) return;
      const [px, py] = relPoint(Math.atan2(dz, dx) - player.heading, d * scale);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const s of state.ships) if (s.id !== player.id) dot(s.x, s.z, '#ff6b6b', 3);
    for (const m of state.missiles) dot(m.x, m.z, '#ffd060', 2);
    for (const c of state.chunks) dot(c.x, c.z, '#8899bb', 2);
  }

  return {
    update(state, player) {
      speedEl.textContent = speedOf(player).toFixed(1);
      let deg = ((player.heading * 180) / Math.PI) % 360;
      if (deg < 0) deg += 360;
      hdgEl.textContent = deg.toFixed(0).padStart(3, '0');
      for (const hp of hull.hardpoints) {
        const cell = cellEls[hp.id];
        cell.classList.toggle('sel', player.selected === hp.id);
        const m = player.mounts[hp.id];
        const frac = m.cooldown > 0 ? 1 - m.cooldown / maxCd(hp) : 1;
        cell.querySelector('i').style.width = (100 * Math.max(0, Math.min(1, frac))).toFixed(0) + '%';
      }
      hpEl.style.width = (100 * Math.max(0, player.hp) / hull.hp).toFixed(1) + '%';
      enemiesEl.textContent = 'ENEMIES ' + state.ships.filter((s) => s.id !== player.id && s.alive).length;
      warnEl.hidden = !state.missiles.some((m) => Math.hypot(m.x - player.x, m.z - player.z) < MISSILE_WARN);
      drawRadar(state, player);
      if (camera) {
        if (getSettings().damageNumbers) {
          for (const ev of state.events) {
            if (!ev.point || ev.damage === undefined) continue;
            const slot = labelPool.find((l) => !l.active) || labelPool[0];
            slot.active = true;
            slot.born = performance.now();
            slot.x = ev.point.x;
            slot.z = ev.point.z;
            slot.el.textContent = String(Math.round(ev.damage));
          }
        }
        const nowMs = performance.now();
        for (const l of labelPool) {
          if (!l.active) continue;
          const age = (nowMs - l.born) / 1000;
          if (age >= FADE) {
            l.active = false;
            l.el.style.display = 'none';
            continue;
          }
          tmpV.set(l.x, 0, l.z).project(camera);
          if (tmpV.z > 1) {
            l.el.style.display = 'none';
            continue;
          }
          l.el.style.display = 'block';
          l.el.style.left = ((tmpV.x * 0.5 + 0.5) * window.innerWidth).toFixed(0) + 'px';
          l.el.style.top = ((-tmpV.y * 0.5 + 0.5) * window.innerHeight - 16).toFixed(0) + 'px';
          l.el.style.opacity = (1 - age / FADE).toFixed(2);
        }
      }
    },
  };
}
