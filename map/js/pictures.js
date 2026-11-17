// One small SVG drawing per kind of machine, drawn around (0,0) inside a box
// about 120 wide and 100 tall. Colours come from CSS (css/map.css):
//   p-body  the machine's main colour (its group colour)
//   p-face  light panel      p-dark  screens, glass and vents
//   p-led   the glowing light  p-line  thin detail lines

const laptop = `
  <rect class="p-body" x="-42" y="-40" width="84" height="58" rx="7"/>
  <rect class="p-dark" x="-34" y="-32" width="68" height="42" rx="3"/>
  <path class="p-line" d="M-26,-22 h22 M-26,-12 h36 M-26,-2 h14"/>
  <path class="p-face" d="M-56,18 h112 l-7,14 h-98 z"/>
  <circle class="p-led" cx="0" cy="25" r="3"/>`;

const tower = `
  <rect class="p-body" x="-32" y="-48" width="64" height="96" rx="8"/>
  <rect class="p-dark" x="-23" y="-39" width="46" height="34" rx="4"/>
  <circle class="p-line" cx="0" cy="-22" r="10"/>
  <circle class="p-led" cx="0" cy="8" r="5"/>
  <path class="p-line" d="M-16,24 h32 M-16,32 h32 M-16,40 h32"/>`;

const mini = `
  <rect class="p-body" x="-46" y="-18" width="92" height="46" rx="10"/>
  <rect class="p-dark" x="-14" y="-2" width="42" height="12" rx="4"/>
  <circle class="p-led" cx="-30" cy="4" r="5"/>
  <path class="p-face" d="M-34,28 h68 l4,8 h-76 z"/>`;

const cube = `
  <rect class="p-body" x="-38" y="-38" width="76" height="76" rx="9"/>
  <circle class="p-dark" cx="0" cy="-6" r="22"/>
  <path class="p-line" d="M0,-28 v44 M-22,-6 h44"/>
  <circle class="p-led" cx="-24" cy="26" r="4"/>
  <path class="p-line" d="M-8,26 h34"/>`;

const serverUnit = (y) => `
  <rect class="p-body" x="-48" y="${y}" width="96" height="26" rx="6"/>
  <circle class="p-led" cx="-35" cy="${y + 13}" r="4"/>
  <path class="p-line" d="M-18,${y + 9} h52 M-18,${y + 17} h52"/>`;

const server = `${serverUnit(-45)}${serverUnit(-13)}${serverUnit(19)}`;

const spark = `
  <rect class="p-body" x="-40" y="-26" width="80" height="54" rx="12"/>
  <rect class="p-dark" x="-30" y="-16" width="60" height="26" rx="6"/>
  <path class="p-line" d="M-22,-8 h44 M-22,-3 h44 M-22,2 h44"/>
  <circle class="p-led" cx="0" cy="19" r="4"/>`;

const ring = [0, 60, 120, 180, 240, 300].map((degrees) => {
  const angle = (degrees * Math.PI) / 180;
  return { x: Math.round(Math.cos(angle) * 28), y: Math.round(Math.sin(angle) * 28) };
});

// A generic mesh: six points around one, every point joined to its neighbours.
const hub = `
  <circle class="p-body" cx="0" cy="0" r="48"/>
  <path class="p-line" d="${ring.map((p, i) => `M0,0 L${p.x},${p.y} L${ring[(i + 1) % 6].x},${ring[(i + 1) % 6].y}`).join(' ')}"/>
  ${ring.map((p) => `<circle class="p-face" cx="${p.x}" cy="${p.y}" r="7"/>`).join('')}
  <circle class="p-led" cx="0" cy="0" r="8"/>`;

export const PICTURES = { laptop, tower, mini, cube, server, spark, hub };
