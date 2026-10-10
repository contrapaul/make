// Procedural low-poly ship. The Group's +X axis is forward (matches the sim's
// forward vector (cos h, sin h) via mesh.rotation.y = -heading).
// Local +Z is the ship's LEFT (port), so hardpoint offset [forward, left]
// maps to local (x = forward, z = left).
function mat(THREE, color, { emissive = null, intensity = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35 });
  if (emissive !== null) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = intensity;
  }
  return m;
}

function box(THREE, w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function buildMount(THREE, weapon, colors) {
  const g = new THREE.Group();
  const grey = mat(THREE, 0x6b7a99);
  if (weapon === 'turret') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 2, 12), grey);
    g.add(base);
    const barrel = box(THREE, 5, 0.9, 0.9, mat(THREE, colors.accent, { emissive: colors.accent, intensity: 0.35 }));
    barrel.position.set(2.5, 1.2, 0);
    g.add(barrel);
  } else if (weapon === 'cannon') {
    g.add(box(THREE, 3, 2.2, 3, grey));
    const barrel = box(THREE, 6, 1, 1, mat(THREE, 0x93a5c4));
    barrel.position.set(3, 0.4, 0);
    g.add(barrel);
  } else { // lance
    const prism = box(THREE, 10, 1.4, 1.4, mat(THREE, 0x93a5c4));
    prism.position.x = 4;
    g.add(prism);
    const tip = box(THREE, 1.5, 2, 2, mat(THREE, colors.accent, { emissive: colors.accent, intensity: 0.6 }));
    tip.position.x = 9;
    g.add(tip);
  }
  return g;
}

// Missile: small elongated cone (pointing +X) with a glowing tail.
export function buildMissile(THREE) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x93a5c4, roughness: 0.5, metalness: 0.4 })
  );
  body.rotation.z = -Math.PI / 2; // axis +Y -> +X
  g.add(body);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8866 }));
  tail.position.x = -2.2;
  g.add(tail);
  return g;
}

export function buildChunk(THREE, c) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(c.size * c.sx, c.size * 0.8, c.size * c.sz),
    new THREE.MeshStandardMaterial({ color: 0x5d6a85, roughness: 0.8, metalness: 0.2 })
  );
}

export function buildShip(THREE, hull, colors) {
  const L = hull.length;
  const deckW = hull.radius * 0.5; // half width of the hull block
  const hullH = hull.radius * 0.45;

  const group = new THREE.Group();
  const primary = mat(THREE, colors.primary);

  // Main hull block: x from -0.5L to +0.25L.
  const body = box(THREE, L * 0.75, hullH, deckW * 2, primary);
  body.position.x = -L * 0.125;
  group.add(body);

  // Prow wedge: 4-sided cone pointing +X.
  const prow = new THREE.Mesh(new THREE.ConeGeometry(deckW, L * 0.3, 4), primary);
  prow.rotation.z = -Math.PI / 2; // axis +Y -> +X
  prow.rotation.y = Math.PI / 4; // flats face up/down/portside/starboard
  prow.position.x = L * 0.25 + L * 0.15;
  group.add(prow);

  // Spine stripe (accent, emissive).
  const stripe = box(THREE, L * 0.5, 0.5, deckW * 0.22, mat(THREE, colors.accent, { emissive: colors.accent, intensity: 0.8 }));
  stripe.position.set(-L * 0.125, hullH / 2 + 0.25, 0);
  group.add(stripe);

  // Engine block at the stern + emissive glow plate (M7 scales intensity w/ thrust).
  const engine = box(THREE, L * 0.1, hullH * 0.8, deckW * 2 * 0.65, mat(THREE, 0x46536e));
  engine.position.x = -L * 0.55;
  group.add(engine);
  const glowMat = mat(THREE, 0x111820, { emissive: colors.glow, intensity: 2.2 });
  const glow = box(THREE, 0.6, hullH * 0.6, deckW * 1.3, glowMat);
  glow.position.x = -L * 0.61;
  group.add(glow);

  // Hardpoints as named children; barrels point along local +X.
  const mounts = {};
  for (const hp of hull.hardpoints) {
    const mount = buildMount(THREE, hp.weapon, colors);
    mount.name = hp.id;
    const [fwd, left] = hp.offset;
    const deckY = hullH / 2;
    mount.position.set(fwd, hp.weapon === 'cannon' ? 0 : deckY + (hp.weapon === 'lance' ? 1 : 0), left);
    group.add(mount);
    mounts[hp.id] = mount;
  }
  group.userData.mounts = mounts;
  group.userData.glowMat = glowMat;
  return group;
}
