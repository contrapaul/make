// Everything the map shows comes from this file. Edit it to fill in the map.
//
// Each machine:
//   id        used in the page address (#home-server). Lowercase, no spaces.
//   name      friendly nickname shown on the map. Not the real hostname.
//   tag       optional. Shown in italics after the name, like (On loan).
//   kind      which picture to draw: laptop, tower, mini, cube, server, spark.
//   group     workstation, ai or server (see GROUPS).
//   os        operating system.
//   purpose   one or two sentences: what this machine is for.
//   specs     list of [label, value] pairs. Add or remove rows freely.
//   services  what runs on it. Each needs an id, a name, a purpose and notes.
//             The map shows the first few; the zoomed panel lists them all.
//   notes     anything else worth saying.
//   images    list of { src, alt }. Put the files in map/images/.
//
// This page is public. Leave out hostnames, addresses and port numbers.

const TODO = '[Paul]';

const emptySpecs = () => [
  ['CPU', TODO],
  ['Graphics', TODO],
  ['Memory', TODO],
  ['Storage', TODO],
  ['Case', TODO],
];

const service = (id, name, purpose = TODO) => ({ id, name, purpose, notes: TODO });

export const GROUPS = [
  { id: 'workstation', label: 'Workstations' },
  { id: 'ai', label: 'AI machines' },
  { id: 'server', label: 'Servers' },
];

export const HUB_ID = 'tailnet';

export const NODES = [
  {
    id: HUB_ID, name: 'Tailnet', kind: 'hub', group: 'hub', os: 'Tailscale',
    purpose: TODO, specs: [], services: [], notes: TODO, images: [],
  },
  {
    id: 'laptop', name: 'Macbook Pro', kind: 'laptop', group: 'workstation', os: 'macOS',
    purpose: TODO, specs: emptySpecs(),
    services: [service('voice-assistant', 'Voice assistant')], notes: TODO, images: [],
  },
  {
    id: 'home-desktop', name: 'Home desktop', kind: 'tower', group: 'workstation', os: 'Windows',
    purpose: TODO, specs: emptySpecs(),
    services: [service('exit-node', 'Exit node'), service('model-server', 'Local AI model server')], notes: TODO, images: [],
  },
  {
    id: 'work-desktop', name: 'Work desktop', kind: 'tower', group: 'workstation', os: 'Windows',
    purpose: TODO, specs: emptySpecs(),
    services: [service('exit-node', 'Exit node')], notes: TODO, images: [],
  },
  {
    id: 'mini-pc', name: 'Mini PC', kind: 'mini', group: 'workstation', os: 'Windows',
    purpose: TODO, specs: emptySpecs(),
    services: [
      service('jellyfin', 'Jellyfin', 'Media server for films, shows and music.'),
      service('audiobookshelf', 'Audiobookshelf', 'Audiobook and podcast server.'),
      service('exit-node', 'Exit node'),
    ],
    notes: TODO, images: [],
  },
  {
    id: 'ai-workstation', name: "AI 'Hot Rod' Rig", kind: 'tower', group: 'ai', os: 'Linux',
    purpose: TODO, specs: emptySpecs(),
    services: [service('model-server', 'Local AI model server')], notes: TODO, images: [],
  },
  {
    id: 'spark', name: 'Spark', tag: 'On loan', kind: 'spark', group: 'ai', os: 'Linux',
    purpose: TODO, specs: emptySpecs(),
    services: [service('model-server', 'Local AI model server')], notes: TODO, images: [],
  },
  {
    id: 'home-server', name: 'Home server', kind: 'server', group: 'server', os: 'Linux',
    purpose: TODO, specs: emptySpecs(),
    services: [
      service('immich', 'Immich', 'Photo and video library with phone backup.'),
      service('home-assistant', 'Home Assistant', 'Smart home control and automation.'),
      service('paperless', 'Paperless-ngx', 'Scanned documents, searchable.'),
      service('navidrome', 'Navidrome', 'Music streaming server.'),
      service('syncthing', 'Syncthing', 'Keeps folders in sync between machines.'),
      service('filebrowser', 'File Browser', 'Web page for browsing files on the server.'),
      service('samba', 'File shares', 'Network folders shared over Samba.'),
      service('backrest', 'Backrest', 'Scheduled backups.'),
      service('uptime-kuma', 'Uptime Kuma', 'Checks that services are up.'),
      service('netdata', 'Netdata', 'Live system monitoring.'),
      service('scrutiny', 'Scrutiny', 'Hard drive health monitoring.'),
      service('ntfy', 'ntfy', 'Push notifications to phones.'),
      service('links', 'Links page', 'A small web page of links, served by nginx.'),
    ],
    notes: TODO, images: [],
  },
  {
    id: 'itx-box', name: 'Test bench', kind: 'cube', group: 'server', os: 'Linux',
    purpose: TODO, specs: emptySpecs(),
    services: [service('hardware-testing', 'Hardware Testing')], notes: TODO, images: [],
  },
  {
    id: 'minecraft-server', name: 'Minecraft server', kind: 'server', group: 'server', os: 'Linux',
    purpose: TODO, specs: emptySpecs(),
    services: [service('world', 'School Minecraft world')], notes: TODO, images: [],
  },
];
