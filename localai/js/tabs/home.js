/* ============================================================
   v100 — Tab 1 (Home) interactions, blueprint §6 Tab 1.
   ------------------------------------------------------------
   The hero "Start exploring" CTA smooth-scrolls to the story.
   Agent-decided: a <button> + JS scroll instead of a hash link, so
   Home's canonical URL (#/home) is never polluted by in-page anchors.
   ============================================================ */

const defaultDoc = () => (typeof document !== 'undefined' ? document : null);

/** Wire the hero CTA → story scroll. DI-friendly for Node tests. */
export function initHome({ doc = defaultDoc() } = {}) {
  const btn = doc.getElementById?.('start-exploring') ?? null;
  const target = doc.getElementById?.('story') ?? null;
  if (!btn || !target) return { scroll: () => {} };

  // §8 courtesy: reduced motion → instant jump, no smooth animation.
  const reduced =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  function scrollToStory() {
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  btn.addEventListener('click', scrollToStory);
  return { scroll: scrollToStory };
}
