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
//   images    list of { src, alt }. Put the files in map/media/.
//
// This page is public. Leave out hostnames, addresses and port numbers.

const TODO = '[Paul]';

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
    purpose: TODO,
    specs: [
      ['CPU', 'Apple M4 Pro'],
      ['Memory', '48GB'],
      ['Storage', '512GB SSD'],
    ],
    services: [service('voice-assistant', 'Voice assistant')], notes: TODO, images: [],
  },
  {
    id: 'home-desktop', name: 'Home desktop', kind: 'tower', group: 'workstation', os: 'Windows',
    purpose: 'My gaming PC. Also used for running small AI models.',
    specs: [
      ['CPU', 'Intel Core i9-13900KF'],
      ['Graphics', '16GB Sapphire RX 9070XT Nitro+'],
      ['Memory', '32GB ADATA XPG Spectrix DDR4-3200'],
      ['Storage', '2 x 1TB NVMe PCIe 4.0, 1 x 512GB NVMe PCIe 3.0, 1 x 512GB SATA SSD'],
      ['Case', 'NZXT H5 Flow'],
      ['Motherboard', 'Gigabyte Aorus Elite AX Z690 V2'],
      ['Power supply', 'Deepcool PN850M 850W'],
    ],
    services: [service('exit-node', 'Exit node'), service('model-server', 'Local AI model server')],
    notes: "If RAM ever drops below \"first child\" prices I'll upgrade from 32GB DDR4 to 128GB, and be able to run larger 'Mixture of Expert' models.",
    images: [
      { src: 'media/homedesktop.webp', alt: 'Home desktop, the gaming PC' },
    ],
  },
  {
    id: 'work-desktop', name: 'Work desktop', kind: 'tower', group: 'workstation', os: 'Windows',
    purpose: 'For 3D modeling at work. The first version was built to handle video editing and made heavy use of older parts from prior builds. I quickly added more memory, and this machine began to be used for 3D modeling far more often than video editing.',
    specs: [
      ['CPU', 'AMD Ryzen 7 5700X'],
      ['Graphics', '8GB Gigabyte RTX 3070'],
      ['Memory', '48GB Corsair Vengeance LPX (32GB DDR4-3000 + 16GB DDR4-3200, set at 2833MT/s)'],
      ['Storage', '2 x 512GB NVMe, 1 x 512GB SATA SSD'],
      ['Case', 'Jonsbo D32 Pro'],
      ['Power supply', 'Cooler Master MWE Gold V2 750W'],
    ],
    services: [service('exit-node', 'Exit node')],
    notes: "It's connected to a KVM switch, and the screen is mirrored on a 27\" 4K monitor at my desk and 2 large displays in the classroom.",
    images: [
      { src: 'media/workdesktop.webp', alt: 'Work desktop, the 3D modeling machine' },
    ],
  },
  {
    id: 'mini-pc', name: 'Mini PC', kind: 'mini', group: 'workstation', os: 'Windows',
    purpose: 'Used for entertainment and occasionally streaming games from my home desktop.',
    specs: [
      ['CPU', 'AMD Ryzen 7 5800H'],
      ['Memory', '16GB DDR4-2133 SO-DIMM'],
      ['Storage', '1 x 500GB NVMe PCIe 4.0, 1 x 512GB M.2 SATA'],
    ],
    services: [
      service('jellyfin', 'Jellyfin', 'Media server for films, shows and music.'),
      service('audiobookshelf', 'Audiobookshelf', 'Audiobook and podcast server.'),
      service('exit-node', 'Exit node'),
    ],
    notes: "Just a lil' guy living next to my home server in the IKEA console table. Connected to my TV.",
    images: [],
  },
  {
    id: 'ai-workstation', name: "AI 'Hot Rod' Rig", kind: 'tower', group: 'ai', os: 'Linux',
    purpose: TODO,
    specs: [
      ['CPU', 'AMD Ryzen 7 5700X'],
      ['Graphics', '2 x 32GB Nvidia V100 SXM2 on NVLink adapter, 1 x 8GB AMD WX5100'],
      ['Memory', '32GB DDR4-3600 Corsair Vengeance'],
      ['Storage', '2 x 512GB NVMe PCIe 4.0'],
      ['Case', '2020 aluminium extrusion frame'],
      ['Power supply', 'Great Wall EPS 1250W'],
    ],
    services: [service('model-server', 'Local AI model server')],
    notes: "The V100s are cooled via a water cooling loop. The radiator and reservoir are mounted to the frame via custom designed brackets printed in polycarbonate.",
    images: [
      { src: 'media/airig.webp', alt: "The AI 'Hot Rod' Rig, an open aluminium extrusion frame with water cooling" },
    ],
  },
  {
    id: 'spark', name: 'Spark', tag: 'On loan', kind: 'spark', group: 'ai', os: 'Linux',
    purpose: TODO,
    specs: [
      ['SoC', "Nvidia GB10 'Superchip'"],
      ['Memory', '128GB unified memory'],
      ['Storage', '4TB NVMe'],
      ['Power supply', '240W external PSU'],
    ],
    services: [service('model-server', 'Local AI model server')], notes: TODO, images: [],
  },
  {
    id: 'home-server', name: 'Home server', kind: 'server', group: 'server', os: 'Linux',
    purpose: TODO,
    specs: [
      ['CPU', 'AMD Ryzen 5 3600'],
      ['Graphics', '4GB PowerColor RX 6500XT'],
      ['Memory', '16GB DDR4-3200 Kingston HyperX Fury'],
      ['Storage', '1 x 256GB NVMe, 7 x 4TB HDD, 1 x 1TB HDD'],
      ['Case', 'StarStreak Sagittarius'],
      ['Power supply', 'Great Wall GOG Hunters X7 750W'],
    ],
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
    notes: 'The first versions of this machine featured a custom designed open frame, but eventually I decided to go with a commercially available chassis.',
    images: [
      { src: 'media/homeserver.webp', alt: 'Home server in its StarStreak Sagittarius case' },
    ],
  },
  {
    id: 'itx-box', name: 'Test bench', kind: 'cube', group: 'server', os: 'Linux',
    purpose: TODO,
    specs: [
      ['CPU', 'Intel Core i7-8700K'],
      ['Memory', '16GB DDR4, mixed'],
      ['Storage', '1 x 256GB NVMe'],
      ['Case', 'Custom 3D printed platform'],
      ['Power supply', 'Antec EA650G Pro 650W'],
    ],
    services: [service('hardware-testing', 'Hardware Testing')], notes: TODO, images: [],
  },
  {
    id: 'minecraft-server', name: 'Minecraft server', kind: 'server', group: 'server', os: 'Linux',
    purpose: TODO,
    specs: [
      ['CPU', 'Intel Core i3-8350T'],
      ['Memory', '16GB DDR4-2400 Micron'],
      ['Storage', '1 x 1TB 2.5" HDD'],
      ['Case', 'Custom 3D printed platform'],
      ['Power supply', 'Huntkey 500W'],
    ],
    services: [service('world', 'School Minecraft world')], notes: TODO,
    images: [
      { src: 'media/minecraftserver.webp', alt: 'Minecraft server in a custom 3D printed platform' },
    ],
  },
];
