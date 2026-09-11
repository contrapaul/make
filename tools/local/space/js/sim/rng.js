// Seeded RNG (mulberry32). js/sim/ must never use the unseeded global RNG.
// createRng(seed) -> { next() [0,1), range(a,b), int(a,b) inclusive }

export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(lo, hi) {
      return lo + (hi - lo) * next();
    },
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    },
  };
}
