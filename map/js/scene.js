// Builds the map as one SVG string. Pure: no DOM, so it can be tested in node.

import { PICTURES } from './pictures.js';
import { NODE, CHIP, layoutNodes, chipsFor, chipRect, nodeBounds, linkPath } from './layout.js';

const BACKDROP = 6000;
const PULSE_SECONDS = 2.6;
const PULSE_STAGGER = 0.45;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function backdrop() {
  const start = -BACKDROP / 2;
  return `
  <defs>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle class="dot" cx="20" cy="20" r="1.6"/>
    </pattern>
  </defs>
  <rect class="backdrop" x="${start}" y="${start}" width="${BACKDROP}" height="${BACKDROP}" fill="url(#dots)"/>`;
}

function zone(group, rect) {
  return `
  <g class="zone group-${group.id}">
    <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="28"/>
    <text x="${rect.x + 24}" y="${rect.y - 12}">${escapeHtml(group.label)}</text>
  </g>`;
}

function link(node, hub, position, zoneRect) {
  return `<path id="link-${node.id}" class="link" data-to="${node.id}" d="${linkPath(hub, position, zoneRect)}"/>`;
}

// Odd pulses travel towards the hub, even ones away from it.
function pulse(node, index) {
  const points = index % 2 ? '1;0' : '0;1';
  const begin = (-index * PULSE_STAGGER).toFixed(2);
  return `
  <circle class="pulse group-${node.group}" r="6">
    <animateMotion dur="${PULSE_SECONDS}s" begin="${begin}s" repeatCount="indefinite"
      calcMode="linear" keyPoints="${points}" keyTimes="0;1">
      <mpath href="#link-${node.id}"/>
    </animateMotion>
  </circle>`;
}

function chip(nodeItem, service, index) {
  const rect = chipRect({ x: 0, y: 0 }, index);
  const which = service.id === null ? '' : ` data-service="${service.id}"`;
  return `
  <g class="chip" data-node="${nodeItem.id}"${which}>
    <rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="${CHIP.h / 2}"/>
    <text x="0" y="${rect.y + CHIP.h / 2}">${escapeHtml(service.name)}</text>
  </g>`;
}

function nodeGroup(nodeItem, position) {
  const chips = chipsFor(nodeItem.services);
  const hit = nodeBounds({ x: 0, y: 0 }, chips.length);
  const tag = nodeItem.tag ? ` <tspan class="tag">(${escapeHtml(nodeItem.tag)})</tspan>` : '';
  return `
  <g class="node group-${nodeItem.group}" data-node="${nodeItem.id}" tabindex="0" role="button"
     aria-label="${escapeHtml(nodeItem.name)}: open details" transform="translate(${position.x} ${position.y})">
    <rect class="hit" x="${hit.x}" y="${hit.y}" width="${hit.w}" height="${hit.h}" rx="16"/>
    <g class="lift">
      <g class="pic">${PICTURES[nodeItem.kind]}</g>
      <text class="name" y="${NODE.labelY}">${escapeHtml(nodeItem.name)}${tag}</text>
      <text class="os" y="${NODE.osY}">${escapeHtml(nodeItem.os)}</text>
    </g>
    ${chips.map((service, i) => chip(nodeItem, service, i)).join('')}
  </g>`;
}

/** `svg.innerHTML = buildScene(NODES, GROUPS, WORLDS.landscape, { pulses: true })` */
export function buildScene(nodes, groups, world, { pulses }) {
  const positions = layoutNodes(nodes, world);
  const spokes = nodes.filter((nodeItem) => nodeItem.group !== 'hub');
  return [
    backdrop(),
    groups.map((group) => zone(group, world.zones[group.id])).join(''),
    spokes.map((n) => link(n, world.hub, positions.get(n.id), world.zones[n.group])).join(''),
    pulses ? spokes.map(pulse).join('') : '',
    nodes.map((n) => nodeGroup(n, positions.get(n.id))).join(''),
  ].join('');
}
