import test from 'node:test';
import assert from 'node:assert/strict';

import { NODES, GROUPS, HUB_ID } from '../js/data.js';
import { WORLDS, orientationFor, layoutNodes, nodeBounds, chipsFor, chipRect, linkPath, roundedPath, MAX_CHIPS } from '../js/layout.js';
import { fitRect, scaleBox, mixBox, easeInOut } from '../js/camera.js';
import { parseRoute, parentHash } from '../js/route.js';
import { buildScene } from '../js/scene.js';
import { PICTURES } from '../js/pictures.js';

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('data: ids are unique and every machine has a known group and picture', () => {
  const ids = NODES.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  const groups = new Set([...GROUPS.map((group) => group.id), 'hub']);
  for (const node of NODES) {
    assert.ok(groups.has(node.group), `${node.id} group ${node.group}`);
    assert.ok(PICTURES[node.kind], `${node.id} picture ${node.kind}`);
  }
});

test('data: nine computers plus the tailnet', () => {
  assert.equal(NODES.length, 10);
  assert.ok(NODES.some((node) => node.id === 'minecraft-server'));
  assert.equal(NODES.filter((node) => node.id === HUB_ID).length, 1);
});

test('data: nothing that identifies the real network', () => {
  const text = JSON.stringify(NODES);
  assert.doesNotMatch(text, /\b100\.\d+\.\d+\.\d+\b/);
  assert.doesNotMatch(text, /ts\.net|:\d{4,5}\b/);
});

test('orientationFor: tall screens are portrait', () => {
  assert.equal(orientationFor(390, 844), 'portrait');
  assert.equal(orientationFor(1440, 900), 'landscape');
  assert.equal(orientationFor(900, 900), 'landscape');
});

for (const [name, world] of Object.entries(WORLDS)) {
  test(`layout ${name}: every machine is inside the world and none overlap`, () => {
    const positions = layoutNodes(NODES, world);
    const boxes = NODES.map((node) => nodeBounds(positions.get(node.id), chipsFor(node.services).length));
    boxes.forEach((box, i) => {
      assert.ok(box.x >= 0 && box.y >= 0, `${NODES[i].id} starts inside`);
      assert.ok(box.x + box.w <= world.w && box.y + box.h <= world.h, `${NODES[i].id} ends inside`);
      for (let j = i + 1; j < boxes.length; j++) {
        assert.ok(!overlaps(box, boxes[j]), `${NODES[i].id} overlaps ${NODES[j].id}`);
      }
    });
  });

  test(`layout ${name}: a machine with the most chips still fits its zone`, () => {
    const positions = layoutNodes(NODES, world);
    for (const node of NODES.filter((candidate) => candidate.group !== 'hub')) {
      const zone = world.zones[node.group];
      const box = nodeBounds(positions.get(node.id), MAX_CHIPS);
      assert.ok(box.y + box.h <= zone.y + zone.h + 1, `${node.id} overflows its zone`);
    }
  });
}

test('layout: the hub sits on the world hub point', () => {
  const positions = layoutNodes(NODES, WORLDS.landscape);
  assert.deepEqual(positions.get(HUB_ID), WORLDS.landscape.hub);
  assert.ok(layoutNodes(NODES, WORLDS.landscape).get('laptop').x < WORLDS.landscape.hub.x);
});

test('chipsFor: a long list folds into a "+N more" chip', () => {
  const services = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, notes: 'x' }));
  assert.deepEqual(chipsFor(services.slice(0, MAX_CHIPS)).map((chip) => chip.id), ['s0', 's1', 's2', 's3']);
  const folded = chipsFor(services);
  assert.equal(folded.length, MAX_CHIPS);
  assert.deepEqual(folded.at(-1), { id: null, name: '+6 more' });
  assert.deepEqual(chipsFor([]), []);
});

test('data: service ids are unique within each machine', () => {
  for (const node of NODES) {
    const ids = node.services.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, node.id);
  }
});

test('chipRect: chips stack downwards inside the node bounds', () => {
  const position = { x: 500, y: 500 };
  const first = chipRect(position, 0);
  const second = chipRect(position, 1);
  assert.ok(second.y >= first.y + first.h);
  const bounds = nodeBounds(position, 2);
  assert.ok(second.y + second.h <= bounds.y + bounds.h);
});

test('layout: the rail runs above the picture, below the row before it', () => {
  for (const world of Object.values(WORLDS)) {
    const positions = layoutNodes(NODES, world);
    for (const node of NODES.filter((candidate) => candidate.group !== 'hub')) {
      const position = positions.get(node.id);
      assert.ok(position.rail < nodeBounds(position, 0).y, `${node.id} rail is above its picture`);
    }
  }
});

test('roundedPath: starts and ends on the end points and rounds each corner', () => {
  const path = roundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 10);
  assert.equal(path, 'M0,0 L90,0 Q100,0 100,10 L100,100');
});

test('roundedPath: a short leg only gives up half its length to a corner', () => {
  const path = roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 100 }], 40);
  assert.equal(path, 'M0,0 L5,0 Q10,0 10,40 L10,100');
});

test('linkPath: leaves the hub, follows the rail, drops into the machine', () => {
  const world = WORLDS.landscape;
  const position = layoutNodes(NODES, world).get('spark');
  const path = linkPath(world.hub, position, world.zones.ai);
  assert.ok(path.startsWith(`M${world.hub.x},${world.hub.y} `));
  assert.ok(path.endsWith(`L${position.x},${position.y}`));
  assert.ok(path.includes(`Q${position.x},${position.rail} `));
});

test('fitRect: centres the target in the free area and keeps the screen shape', () => {
  const target = { x: 100, y: 100, w: 200, h: 100 };
  const viewport = { w: 1000, h: 500 };
  const free = { x: 0, y: 0, w: 0.5, h: 1 };
  const box = fitRect(target, viewport, free);
  assert.equal(box.w / box.h, 2);
  const scale = viewport.w / box.w;
  assert.equal(scale, 2.5);
  assert.equal((200 - box.x) * scale, 250);
  assert.equal((150 - box.y) * scale, 250);
});

test('fitRect: a target the same shape as the screen fills it', () => {
  const box = fitRect({ x: 0, y: 0, w: 1600, h: 1000 }, { w: 800, h: 500 }, { x: 0, y: 0, w: 1, h: 1 });
  assert.deepEqual(box, { x: 0, y: 0, w: 1600, h: 1000 });
});

test('scaleBox: grows about the centre', () => {
  assert.deepEqual(scaleBox({ x: 0, y: 0, w: 100, h: 50 }, 2), { x: -50, y: -25, w: 200, h: 100 });
});

test('mixBox: ends match and the zoom point stays put', () => {
  const from = { x: 0, y: 0, w: 1000, h: 500 };
  const to = { x: 600, y: 300, w: 100, h: 50 };
  assert.deepEqual(mixBox(from, to, 0), from);
  const end = mixBox(from, to, 1);
  for (const key of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(end[key] - to[key]) < 1e-9, key);
  const mid = mixBox(from, to, 0.5);
  assert.ok(Math.abs(mid.w / mid.h - 2) < 1e-9);
  assert.ok(mid.w < 550, 'size changes by ratio, so half way is well under the average');
});

test('mixBox: equal sizes slide in a straight line', () => {
  const mid = mixBox({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 20, w: 10, h: 10 }, 0.5);
  assert.deepEqual(mid, { x: 5, y: 10, w: 10, h: 10 });
});

test('easeInOut: runs from 0 to 1', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(0.5), 0.5);
  assert.equal(easeInOut(1), 1);
});

test('parseRoute: tabs, machines, services and unknown addresses', () => {
  assert.equal(parseRoute('', NODES).view, 'map');
  assert.equal(parseRoute('#', NODES).view, 'map');
  assert.equal(parseRoute('#nope', NODES).view, 'map');
  assert.equal(parseRoute('#history', NODES).view, 'history');
  const node = parseRoute('#spark', NODES);
  assert.equal(node.view, 'node');
  assert.equal(node.node.id, 'spark');
  const service = parseRoute('#spark/model-server', NODES);
  assert.equal(service.view, 'service');
  assert.equal(service.service.id, 'model-server');
  assert.equal(parseRoute('#spark/nope', NODES).view, 'node');
});

test('parentHash: zooms out one level', () => {
  assert.equal(parentHash(parseRoute('#spark/model-server', NODES)), '#spark');
  assert.equal(parentHash(parseRoute('#spark', NODES)), '#');
  assert.equal(parentHash(parseRoute('#about', NODES)), '#');
});

test('buildScene: one node, link and pulse per machine, and an italic tag', () => {
  const world = WORLDS.landscape;
  const svg = buildScene(NODES, GROUPS, world, { pulses: true });
  assert.equal(svg.match(/class="node /g).length, NODES.length);
  assert.equal(svg.match(/class="link"/g).length, NODES.length - 1);
  assert.equal(svg.match(/<animateMotion/g).length, NODES.length - 1);
  assert.match(svg, />\+10 more</);
  assert.doesNotMatch(svg, /data-service="ntfy"/);
  assert.match(svg, /Spark <tspan class="tag">\(On loan\)<\/tspan>/);
});

test('buildScene: no pulses when motion is turned off, and text is escaped', () => {
  const nodes = [{ ...NODES[1], name: '<b>&' }];
  const svg = buildScene(nodes, GROUPS, WORLDS.portrait, { pulses: false });
  assert.doesNotMatch(svg, /<animateMotion/);
  assert.match(svg, /&lt;b&gt;&amp;/);
  assert.doesNotMatch(svg, /<b>/);
});

test('panelHtml: machine panel lists specs and links to its services', async () => {
  const { panelHtml } = await import('../js/panel.js');
  const html = panelHtml(parseRoute('#spark', NODES));
  assert.match(html, /<h2 class="group-ai">Spark <em>\(On loan\)<\/em><\/h2>/);
  assert.doesNotMatch(html, /tailnet/i);
  assert.match(html, /href="#spark\/model-server"/);
  assert.match(html, /<dt>SoC<\/dt>/);
  assert.match(html, /Superchip/);
  const service = panelHtml(parseRoute('#spark/model-server', NODES));
  assert.match(service, /Runs on Spark/);
  assert.match(service, /href="#spark"/);
});
