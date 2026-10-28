// Category → colour map for the 1-Afternoon Coding Projects site.
// Colours come from the soundboard pad palette (tools/soundboard/js/soundboard-core.js).
// One colour per bucket: the sticky visual hook that lets the eye group 150 cards.
// Pure data; tested in test/colors.test.mjs (valid hex, no collisions).

export const CATEGORY_COLORS = {
  'games':          '#FF6B6B',  // coral red
  'creative':       '#FF7AC6',  // pink
  'utilities':      '#6C8CFF',  // blue-violet
  'task-processing':'#FFD93D',  // yellow
  'data-analysis':  '#C8F169',  // lime
  'web-devops':     '#B47CFF',  // purple
  'learning-cs':    '#4DD4F0',  // cyan
  'productivity':   '#FF9F43',  // orange
  'education':      '#6BCB77',  // green
};

/** Colour for a category id (falls back to the soft line colour). */
export function colorForCategory(id) {
  return CATEGORY_COLORS[id] || '#E7D9BD';
}
