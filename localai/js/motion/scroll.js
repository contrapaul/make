/* ============================================================
   v100 — Scroll reveal engine + micro-interactions (blueprint §8)
   ------------------------------------------------------------
   - One-way reveals: IntersectionObserver with rootMargin
     "-10% 0px". An element gains .in-view the first time it enters
     the band and is then UNOBSERVED — it never re-animates. No lib.
     (2026-09-05: reveals used to be reversible, removing .in-view on
     exit. An element left parked at the band edge then flipped in/out
     on the smallest scroll jitter and replayed its fade+slide, which
     read as looping/bouncing. Reveal-once is the pi.dev behaviour the
     page was modelled on: things arrive, then stay put.)
   - Stagger: --i = ordinal among data-reveal siblings within the
     same parent; CSS applies transition-delay calc(var(--i)*60ms).
   - prefers-reduced-motion is handled in base.css (instant,
     opacity-only reveals; ambient drift off) — no JS branch needed.
   - No DOM access at import time → Node-testable.
   ============================================================ */

/** Stagger index for one element: its position among data-reveal siblings. */
export function revealStaggerIndex(el) {
  const parent = el && el.parentElement;
  if (!parent || !parent.children) return 0;
  let i = 0;
  for (const child of parent.children) {
    if (child === el) break;
    if (typeof child.hasAttribute === 'function' && child.hasAttribute('data-reveal')) i += 1;
  }
  return i;
}

/**
 * Observe every [data-reveal] element under `root`.
 * Returns { els, disconnect() }.
 */
export function initReveals({ root = defaultRoot(), IO = defaultIO() } = {}) {
  const els = Array.from(root.querySelectorAll('[data-reveal]'));

  for (const el of els) {
    if (el.style && typeof el.style.setProperty === 'function') {
      el.style.setProperty('--i', String(revealStaggerIndex(el)));
    }
  }

  if (!IO || els.length === 0) return { els, disconnect() {} };

  const io = new IO(
    (entries) => {
      for (const entry of entries) {
        const el = entry && entry.target;
        if (!el || !el.classList || !entry.isIntersecting) continue;
        el.classList.add('in-view');
        // Reveal once, then stop watching: nothing can replay the
        // animation, however the visitor scrolls (§8).
        if (typeof io.unobserve === 'function') io.unobserve(el);
      }
    },
    { rootMargin: '-10% 0px', threshold: 0 }
  );

  for (const el of els) io.observe(el);
  return { els, disconnect() { io.disconnect(); } };
}

/* ---------- §8 micro-interactions ---------------------------- */

/** Pulse a printout row after a value change (restarts on rapid changes). */
export function pulse(el) {
  if (!el || !el.classList) return;
  el.classList.remove('is-pulsing');
  void el.offsetWidth; // reflow so the animation can restart
  el.classList.add('is-pulsing');
  const clear = () => el.classList.remove('is-pulsing');
  if (typeof el.addEventListener === 'function') {
    el.addEventListener('animationend', clear, { once: true });
  }
}

/** Keep a range input's filled track in sync via the --val custom property. */
export function bindRangeFill(input) {
  if (!input || typeof input.addEventListener !== 'function') return;

  const update = () => {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const v = parseFloat(input.value);
    let pct = 50;
    if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(v) && max > min) {
      pct = ((v - min) / (max - min)) * 100;
    }
    if (input.style && typeof input.style.setProperty === 'function') {
      input.style.setProperty('--val', `${pct.toFixed(2)}%`);
    }
  };

  update();
  input.addEventListener('input', update);
}

/* ---------- defaults (browser only) -------------------------- */
const defaultRoot = () => (typeof document !== 'undefined' ? document : null);
const defaultIO = () => (typeof IntersectionObserver !== 'undefined' ? IntersectionObserver : null);
