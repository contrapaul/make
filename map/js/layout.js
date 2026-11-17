// Where things sit in the map's own coordinate space. Pure: no DOM.

export const NODE = { halfWidth: 84, top: 60, labelY: 74, osY: 91 };
export const CHIP = { w: 164, h: 26, gap: 6, top: 104 };
export const MAX_CHIPS = 4;
const ZONE_HEAD = 40;
const NODE_DROP = 80;
const RAIL_RISE = 18;
const CORNER = 36;
const PORTRAIT_BELOW = 0.9;

// One world per screen shape. Zones are the role groups; `cols` is how many
// machines sit side by side inside a zone. `trunk` is where that zone's
// network lines leave the hub for: an x beside the zone (wide screens), or a
// point in the gap between zones (tall screens).
export const WORLDS = {
  landscape: {
    w: 1600, h: 1000, hub: { x: 800, y: 480 },
    zones: {
      workstation: { x: 60, y: 110, w: 520, h: 800, cols: 2, trunk: { x: 640 } },
      ai: { x: 1020, y: 80, w: 520, h: 380, cols: 2, trunk: { x: 960 } },
      server: { x: 960, y: 550, w: 600, h: 390, cols: 3, trunk: { x: 900 } },
    },
  },
  portrait: {
    w: 1000, h: 1800, hub: { x: 500, y: 560 },
    zones: {
      ai: { x: 60, y: 70, w: 880, h: 370, cols: 2, trunk: { x: 500, y: 470 } },
      workstation: { x: 30, y: 720, w: 520, h: 1040, cols: 2, trunk: { x: 570, y: 670 } },
      server: { x: 590, y: 720, w: 380, h: 1040, cols: 1, trunk: { x: 570, y: 670 } },
    },
  },
};

export function orientationFor(width, height) {
  return width / height < PORTRAIT_BELOW ? 'portrait' : 'landscape';
}

function placeInZone(zone, index, count) {
  const rows = Math.ceil(count / zone.cols);
  const cellW = zone.w / zone.cols;
  const cellH = (zone.h - ZONE_HEAD) / rows;
  const col = index % zone.cols;
  const row = Math.floor(index / zone.cols);
  const cellTop = zone.y + ZONE_HEAD + cellH * row;
  // `rail` is the height of the clear strip above this row, where its
  // network lines run before dropping down into each machine.
  return { x: zone.x + cellW * (col + 0.5), y: cellTop + NODE_DROP, rail: cellTop - RAIL_RISE };
}

/** Map of node id to its centre point. `layoutNodes(NODES, WORLDS.landscape)` */
export function layoutNodes(nodes, world) {
  const positions = new Map();
  for (const [groupId, zone] of Object.entries(world.zones)) {
    const members = nodes.filter((node) => node.group === groupId);
    members.forEach((node, i) => positions.set(node.id, placeInZone(zone, i, members.length)));
  }
  for (const node of nodes) {
    if (!positions.has(node.id)) positions.set(node.id, { ...world.hub });
  }
  return positions;
}

/**
 * The chips drawn under a machine. A machine with many services shows the
 * first few and a "+N more" chip (id null); the panel lists them all.
 * `chipsFor(node.services)` gives [{ id, name }, ...]
 */
export function chipsFor(services) {
  const chips = services.map(({ id, name }) => ({ id, name }));
  if (chips.length <= MAX_CHIPS) return chips;
  const shown = chips.slice(0, MAX_CHIPS - 1);
  return [...shown, { id: null, name: `+${chips.length - shown.length} more` }];
}

export function chipRect(position, index) {
  return {
    x: position.x - CHIP.w / 2,
    y: position.y + CHIP.top + index * (CHIP.h + CHIP.gap),
    w: CHIP.w,
    h: CHIP.h,
  };
}

/** The box that holds a machine's picture, label and service chips. */
export function nodeBounds(position, chipCount) {
  const chipsEnd = CHIP.top + chipCount * (CHIP.h + CHIP.gap);
  return {
    x: position.x - NODE.halfWidth,
    y: position.y - NODE.top,
    w: NODE.halfWidth * 2,
    h: NODE.top + Math.max(chipsEnd, CHIP.top),
  };
}

export function padRect(rect, pad) {
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 };
}

const along = (from, to, distance) => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const t = Math.min(distance, length / 2) / length;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
};

/** An SVG path through `points` with every corner rounded off. */
export function roundedPath(points, radius = CORNER) {
  const last = points.length - 1;
  const corners = points.slice(1, last).map((corner, i) => {
    const before = along(corner, points[i], radius);
    const after = along(corner, points[i + 2], radius);
    return `L${before.x},${before.y} Q${corner.x},${corner.y} ${after.x},${after.y}`;
  });
  return [`M${points[0].x},${points[0].y}`, ...corners, `L${points[last].x},${points[last].y}`].join(' ');
}

/**
 * The cable from the hub to a machine: out to the zone's trunk, along the
 * rail above the machine's row, then down into it. It never crosses another
 * machine. `linkPath(world.hub, positions.get('spark'), world.zones.ai)`
 */
export function linkPath(hub, position, zone) {
  const { trunk } = zone;
  const lead = trunk.y === undefined ? [] : [{ x: trunk.x, y: trunk.y }];
  return roundedPath([
    hub,
    ...lead,
    { x: trunk.x, y: position.rail },
    { x: position.x, y: position.rail },
    { x: position.x, y: position.y },
  ]);
}
