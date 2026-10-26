// e02 shell: hash router + tab mount. No build step, no npm deps.
// resolveRoute is pure so Node can test it (test/router.test.mjs).
export function resolveRoute(hash) {
  const h = String(hash || '');
  if (h === '' || h === '#' || h === '#/') return { tab: 'random' };
  // routes are strict: '#/<segment>'. anything else (including '#browse')
  // falls back to the random tab.
  if (!h.startsWith('#/')) return { tab: 'random' };
  const parts = h.slice(1).split('/').filter(Boolean);
  if (parts.length >= 1 && parts[0] === 'random') return { tab: 'random' };
  if (parts.length >= 1 && parts[0] === 'browse') return { tab: 'browse' };
  if (parts.length >= 1 && parts[0] === 'resources') return { tab: 'resources' };
  if (parts[0] === 'glossary') {
    return parts[1] ? { tab: 'glossary', id: parts[1] } : { tab: 'glossary' };
  }
  return { tab: 'random' };
}

// Tab registry lives at top level so Node can import the tab modules.
const renderers = {};
export function registerTab(name, render) { renderers[name] = render; }
export function getRenderer(name) { return renderers[name]; }

// Browser-only wiring. Guarded so importing this module in Node is safe.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  async function render() {
    const { tab, id } = resolveRoute(window.location.hash);
    document.querySelectorAll('.tabs a').forEach(a => {
      a.classList.toggle('active', a.dataset.tab === tab);
    });
    const stage = document.getElementById('stage');
    if (!stage) return;
    stage.classList.remove('rendered');
    try {
      const r = renderers[tab] || renderers.random;
      await r(stage, { id });
      stage.classList.add('rendered');
    } catch (err) {
      stage.textContent = 'Page error: ' + err.message;
    }
    window.dispatchEvent(new Event('site:rendered', { detail: { tab } }));
  }
  window.addEventListener('load', () => {
    window.addEventListener('hashchange', render);
    render();
  });
}
