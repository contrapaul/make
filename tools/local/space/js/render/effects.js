// Pooled visual effects: gun tracers, cannon shells, lance beam, muzzle
// flashes, damage-scaled impact blasts, hit rings.
// Fixed pools + reused temp vectors — never allocates inside sync().
import { WEAPONS } from '../data/weapons.js';

const RING_LIFE = 0.3;
const FLASH_LIFE = 0.12;
const BLAST_LIFE = 0.3;
const TRAIL = 2; // tracer length behind the round (units)
const FLASH_SIZE = { gun: 2.5, cannon: 8, lance: 5 }; // muzzle flash per weapon

export function createEffects(THREE, scene) {
  const up = new THREE.Vector3(0, 1, 0);
  const vDir = new THREE.Vector3();
  const vMid = new THREE.Vector3();

  function pool(n, make) {
    const items = [];
    for (let i = 0; i < n; i++) {
      const obj = make();
      obj.visible = false;
      scene.add(obj);
      items.push({ obj, id: -1, born: 0 });
    }
    return items;
  }

  const tracers = pool(64, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.9 }));
  });
  const shells = pool(16, () =>
    new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }))
  );
  const beams = pool(4, () =>
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.9 })
    )
  );
  const rings = pool(24, () => {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    r.rotation.x = -Math.PI / 2;
    return r;
  });
  const flashes = pool(24, () =>
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.95 })
    )
  );
  const blasts = pool(24, () =>
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.9 })
    )
  );

  function slot(items, id) {
    let s = items.find((x) => x.id === id);
    if (!s) s = items.find((x) => x.id === -1);
    if (s) s.id = id;
    return s;
  }

  // Events outlive the frame they were emitted in, so consume by seq —
  // exactly once per event, even while paused.
  let lastState = null;
  let lastSeq = 0;

  function sync(state) {
    if (state !== lastState) {
      lastState = state;
      lastSeq = 0;
    }
    const beamDur = WEAPONS.lance.beamMs / 1000;

    for (const p of state.projectiles) {
      if (p.kind === 'gun') {
        const s = slot(tracers, p.id);
        if (!s) continue;
        const l = Math.hypot(p.vx, p.vz) || 1;
        const pos = s.obj.geometry.attributes.position;
        pos.setXYZ(0, p.x - (p.vx / l) * TRAIL, 0, p.z - (p.vz / l) * TRAIL);
        pos.setXYZ(1, p.x, 0, p.z);
        pos.needsUpdate = true;
        s.obj.visible = true;
      } else {
        const s = slot(shells, p.id);
        if (!s) continue;
        s.obj.position.set(p.x, 0, p.z);
        s.obj.visible = true;
      }
    }
    for (const list of [tracers, shells]) {
      for (const s of list) {
        if (s.id !== -1 && !state.projectiles.some((p) => p.id === s.id)) {
          s.id = -1;
          s.obj.visible = false;
        }
      }
    }

    const liveBeams = new Set(state.beams.map((b) => b.expires));
    for (const b of state.beams) {
      const s = slot(beams, b.expires);
      if (!s) continue;
      vDir.set(b.x1 - b.x0, 0, b.z1 - b.z0);
      const len = vDir.length() || 0.001;
      vMid.set(b.x0, 0, b.z0).addScaledVector(vDir, 0.5);
      s.obj.position.copy(vMid);
      s.obj.quaternion.setFromUnitVectors(up, vDir.normalize());
      s.obj.scale.set(1, len, 1);
      s.obj.material.opacity = Math.max(0, 1 - (state.time - (b.expires - beamDur)) / beamDur) * 0.9;
      s.obj.visible = true;
    }
    for (const s of beams) {
      if (s.id !== -1 && !liveBeams.has(s.id)) {
        s.id = -1;
        s.obj.visible = false;
      }
    }

    // Fresh events: muzzle flash on fire, ring + damage-scaled blast on hit.
    for (const ev of state.events) {
      if (!ev.seq || ev.seq <= lastSeq) continue;
      lastSeq = Math.max(lastSeq, ev.seq);
      if (ev.type === 'fire') {
        const s = slot(flashes, -1);
        if (s) {
          s.born = state.time;
          s.size = FLASH_SIZE[ev.kind] || 3;
          s.obj.position.set(ev.point.x, 0.4, ev.point.z);
          s.obj.scale.set(0.5, 0.5, 0.5);
          s.obj.visible = true;
        }
      }
      if (ev.type === 'hit' && ev.point) {
        const r = slot(rings, -1);
        if (r) {
          r.born = state.time;
          r.obj.position.set(ev.point.x, 0.3, ev.point.z);
          r.obj.scale.set(1, 1, 1);
          r.obj.visible = true;
        }
        const b = slot(blasts, -1);
        if (b) {
          b.born = state.time;
          b.size = 2 + Math.sqrt(Math.max(1, ev.damage || 3)) * 1.1;
          b.obj.position.set(ev.point.x, 0.6, ev.point.z);
          b.obj.scale.set(0.5, 0.5, 0.5);
          b.obj.visible = true;
        }
      }
    }

    // Rings expand + fade.
    for (const s of rings) {
      if (s.id === -1) continue;
      const age = state.time - s.born;
      if (age >= RING_LIFE) {
        s.id = -1;
        s.obj.visible = false;
        continue;
      }
      const k = age / RING_LIFE;
      s.obj.scale.set(1 + k * 7, 1 + k * 7, 1);
      s.obj.material.opacity = 0.8 * (1 - k);
    }
    // Flashes: quick pop at the muzzle.
    for (const s of flashes) {
      if (s.id === -1) continue;
      const age = state.time - s.born;
      if (age >= FLASH_LIFE) {
        s.id = -1;
        s.obj.visible = false;
        continue;
      }
      const k = age / FLASH_LIFE;
      const sc = (s.size || 3) * (0.5 + k * 0.8);
      s.obj.scale.set(sc, sc, sc);
      s.obj.material.opacity = 0.95 * (1 - k);
    }
    // Blasts: expand to a damage-scaled size and fade.
    for (const s of blasts) {
      if (s.id === -1) continue;
      const age = state.time - s.born;
      if (age >= BLAST_LIFE) {
        s.id = -1;
        s.obj.visible = false;
        continue;
      }
      const k = age / BLAST_LIFE;
      const sc = (s.size || 4) * (0.4 + k * 0.9);
      s.obj.scale.set(sc, sc, sc);
      s.obj.material.opacity = 0.9 * (1 - k);
    }
  }

  return { sync };
}
