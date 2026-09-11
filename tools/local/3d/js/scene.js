import { PLANETS } from './sim.js';

// Builds the full static scene. Returns handles for the animation loop / UI.
export function buildScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  // Sun + lighting (three r155+ physical light units).
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(3, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xffc857 })
  );
  scene.add(sun);
  scene.add(new THREE.PointLight(0xffe0b0, 800, 0, 1.6));
  scene.add(new THREE.AmbientLight(0x223344, 0.6));

  // Planets, grouped so picking/UI can find them.
  const planets = new THREE.Group();
  planets.name = 'planets';
  for (const planet of PLANETS) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planet.radius, 32, 32),
      new THREE.MeshStandardMaterial({ color: planet.color, roughness: 0.7, metalness: 0.1 })
    );
    mesh.name = planet.name;
    mesh.userData.planet = planet;
    planets.add(mesh);
  }
  scene.add(planets);

  // Orbit rings, each tilted to match its planet's orbit.
  const rings = PLANETS.map((planet) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(planet.orbit - 0.03, planet.orbit + 0.03, 128),
      new THREE.MeshBasicMaterial({
        color: 0x3a4b6a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      })
    );
    ring.rotation.x = -Math.PI / 2 + planet.tilt;
    scene.add(ring);
    return ring;
  });

  // Starfield: 3000 points in a shell of radius 300-600.
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 300 + Math.random() * 300;
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: true, color: 0xdde6ff })
  );
  scene.add(stars);

  return { scene, sun, planets, rings, stars };
}
