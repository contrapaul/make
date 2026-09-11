import * as THREE from 'three';

// Raycast click selection. Fires only if the pointer moved < 5 px between
// pointerdown and pointerup, so orbit-drags never select.
export function setupPicking({ renderer, camera, planetsGroup, onSelect }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved >= 5) return;

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetsGroup.children, false);
    onSelect(hits.length ? hits[0].object : null);
  });
}
