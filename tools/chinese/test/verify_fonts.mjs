// Headless-Edge verification for tools/chinese font self-hosting (PLAN-fonts.md §7).
// usage: node tools/chinese/test/verify_fonts.mjs
// Loads every page and asserts:
//   1. no request leaves localhost           (the China requirement)
//   2. only the four shipped faces are loaded
//   3. every pinyin glyph is painted by a shipped face that carries that glyph
//      (the defect that motivated the swap: Newsreader lacks the third-tone carons)
//   4. the CSS-drawn chrome marks resolve (↕ ≡ ✓ × and the remove-button cross)
//   5. both feedback states render, in light and dark
// Screenshots land in tools/chinese/test/shots/.
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, makeChecks, sleep } from './browser.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = resolve(here, '..');
const shots = join(here, 'shots');
const PAGES = ['index.html', 'lessons.html', 'glossary.html', 'sentence-builder.html',
  'tone-trainer.html'];
const EXPECTED_FACES = ['Noto Serif SC', 'Source Serif 4', 'Source Serif 4 Italic', 'Instrument Sans'];
const CARONS = ['ǎ', 'ǐ', 'ǒ', 'ǔ', 'ǖ', 'ǘ', 'ǚ', 'ǜ'];
// Families we did not ship. If one of these paints a pinyin glyph, self-hosting leaked.
const SYSTEM_FACES = /(^|[\s,"])(-apple-system|system-ui|BlinkMacSystemFont|San Francisco|San\b|Helvetica|Arial|Songti|STSong|SimSun|Times|Georgia|Palatino|Iowan|Segoe|Roboto|Noto Sans CJK)([\s,"]|$| Serif)/i;
const SHIPPED_FACES = /^(Source Serif 4|Noto Serif SC|Instrument Sans)$/;
// In-page: elements whose own text carries a pinyin tone mark, with the first family of
// the stack that paints them. Shipped faces are force-loaded first: a face behind a
// display:none container is never fetched, and document.fonts.check reports "not
// loaded" for a glyph that would render correctly once visible.
const PINYIN_SCAN = `(async () => {
  await Promise.all([
    document.fonts.load('400 16px "Source Serif 4"'), document.fonts.load('600 16px "Source Serif 4"'),
    document.fonts.load('italic 400 16px "Source Serif 4"'), document.fonts.load('italic 600 16px "Source Serif 4"'),
    document.fonts.load('400 16px "Noto Serif SC"'), document.fonts.load('400 16px "Instrument Sans"')
  ]);
  const pinyin = /[\u00C0-\u024F]/;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('');
    if (!pinyin.test(own)) continue;
    const cs = getComputedStyle(el);
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const glyphs = [...new Set(own.match(/[\u00C0-\u024F]/g))].join('');
    out.push({ fam, glyphs, text: own.trim().slice(0, 28),
               ok: document.fonts.check(cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' "' + fam + '"', glyphs) });
  }
  return out;
})()`;

const { check, failures } = makeChecks();
rmSync(shots, { recursive: true, force: true });
const { tab, base, stop } = await launch({ siteDir, port: 8899, cdpPort: 9399, shotsDir: shots });

try {
  const loadedFaces = [];
  for (const page of PAGES) {
    console.log(`\n--- ${page}`);
    await tab.goto(`${base}/${page}`);
    const external = tab.external(base);
    check(external.length === 0, `${page}: zero external requests`,
      external.length ? external.slice(0, 3).join(', ') : '');
    const state = await tab.evaluate(`(async () => ({
      loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + (f.style === 'italic' ? ' Italic' : '')),
      carons: ${JSON.stringify(CARONS)}.map(c => document.fonts.check('16px "Source Serif 4"', c)),
      pinyin: await ${PINYIN_SCAN},
      tofu: document.body.innerText.includes('\\uFFFD'),
    }))()`);
    const faces = [...new Set(state.loaded)];
    loadedFaces.push(...faces);
    check(faces.length > 0 && faces.every((f) => EXPECTED_FACES.includes(f)),
      `${page}: only shipped faces loaded (${faces.length})`, faces.join(' | '));
    check(state.carons.every(Boolean), `${page}: Source Serif 4 carries all 8 carons`,
      CARONS.filter((_, i) => !state.carons[i]).join(''));
    const leaked = state.pinyin.filter((p) => !SHIPPED_FACES.test(p.fam) || SYSTEM_FACES.test(p.fam));
    const missing = state.pinyin.filter((p) => !p.ok);
    check(state.pinyin.length > 0 && leaked.length === 0,
      `${page}: ${state.pinyin.length} pinyin element(s) painted by a shipped face`,
      leaked.length ? `${leaked[0].fam} on "${leaked[0].text}"` : '');
    check(missing.length === 0, `${page}: painting face carries every tone mark it draws`,
      missing.length ? `${missing[0].fam} lacks "${missing[0].glyphs}" on "${missing[0].text}"` : '');
    check(!state.tofu, `${page}: no replacement characters in the rendered text`);
    await tab.screenshot(join(shots, `${page.replace('.html', '')}-light.png`));
  }
  const union = [...new Set(loadedFaces)];
  check(EXPECTED_FACES.every((f) => union.includes(f)),
    'site: all four shipped faces load somewhere', union.join(' | '));

  // Chrome glyphs and both feedback states, on the pages that own them.
  console.log('\n--- chrome glyphs + feedback states');
  await tab.goto(`${base}/glossary.html`);
  const chrome = await tab.evaluate(`(() => {
    const arrow = document.querySelector('.sort-indicator, th .sort-indicator');
    const toggle = document.querySelector('.sidebar-toggle');
    return { sort: arrow ? arrow.textContent.trim() : 'missing',
             toggle: toggle ? toggle.textContent.trim() : 'missing',
             sortFam: arrow ? getComputedStyle(arrow).fontFamily.split(',')[0] : '',
             toggleFam: toggle ? getComputedStyle(toggle).fontFamily.split(',')[0] : '' };
  })()`);
  check(chrome.sort.includes('↕'), 'glossary: sort indicator ↕ present', JSON.stringify(chrome));
  check(/≡|▼/.test(chrome.toggle), 'sidebar toggle glyph present', chrome.toggle);
  check(SHIPPED_FACES.test(chrome.sortFam.replace(/"/g, '')) &&
        SHIPPED_FACES.test(chrome.toggleFam.replace(/"/g, '')),
    'chrome glyphs resolve to a shipped face first', `${chrome.sortFam} / ${chrome.toggleFam}`);

  await tab.goto(`${base}/tone-trainer.html`);
  const feedback = await tab.evaluate(`(() => {
    const el = document.querySelector('.trainer-feedback') || document.querySelector('.feedback-bar');
    if (!el) return { error: 'no feedback element' };
    const read = (cls) => { el.className = 'trainer-feedback show ' + cls;
      const cs = getComputedStyle(el, '::before');
      return { content: cs.content, color: getComputedStyle(el).color }; };
    return { correct: read('correct'), incorrect: read('incorrect') };
  })()`);
  check(feedback.correct?.content?.includes('✓'), 'tone trainer: correct mark is a CSS ✓',
    JSON.stringify(feedback.correct));
  check(feedback.incorrect?.content?.includes('×'), 'tone trainer: incorrect mark is a CSS ×',
    JSON.stringify(feedback.incorrect));
  for (const theme of ['light', 'dark']) {
    await tab.evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`);
    await sleep(400);
    await tab.screenshot(join(shots, `tone-trainer-feedback-${theme}.png`));
  }

  await tab.goto(`${base}/sentence-builder.html`);
  // The cross is stylesheet work, so probe the rules on a synthetic filled slot rather
  // than depending on game state to produce one.
  const cross = await tab.evaluate(`(() => {
    const slot = document.createElement('div');
    slot.className = 'slot filled';
    const b = document.createElement('button');
    b.className = 'remove-btn';
    b.setAttribute('aria-label', 'Remove');
    // The stylesheet reveals the button on hover; render it directly for the probe.
    b.style.display = 'flex';
    slot.appendChild(b); document.body.appendChild(slot);
    const before = getComputedStyle(b, '::before'), after = getComputedStyle(b, '::after');
    const r = { empty: b.textContent.trim() === '', aria: b.getAttribute('aria-label'),
                display: getComputedStyle(b).display, barHeight: before.height,
                barBg: before.backgroundColor, before: before.transform, after: after.transform };
    slot.remove(); return r;
  })()`);
  const isRot = (t) => /matrix\(0\.707/.test(t); // ±45° as a computed matrix
  const crossed = cross.empty && cross.barHeight !== '0px' && cross.barBg !== 'rgba(0, 0, 0, 0)'
    && isRot(cross.before) && isRot(cross.after) && cross.before !== cross.after;
  check(crossed, 'sentence builder: remove button draws a two-bar cross', JSON.stringify(cross));
  check(!/✕|✖/.test(await tab.evaluate('document.body.innerText')),
    'sentence builder: no ✕ character anywhere in the page text');

  // Viewport sweep + dark theme shots.
  for (const [w, h, name] of [[1280, 900, 'desktop'], [375, 780, 'phone'], [320, 700, 'narrow']]) {
    await tab.setViewport(w, h, w < 500);
    for (const page of PAGES.map((p) => p.replace('.html', ''))) {
      await tab.goto(`${base}/${page}.html`);
      await tab.screenshot(join(shots, `${page}-${name}.png`));
    }
  }
  console.log(`\nscreenshots: ${shots}`);
} finally {
  stop();
}

console.log(`\n${failures.length ? `FAIL (${failures.length})` : 'PASS'}: ${failures.join('; ') || 'all checks green'}`);
process.exit(failures.length ? 1 : 0);
