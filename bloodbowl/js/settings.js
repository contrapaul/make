'use strict';

/* ═══════════════════════════════════════════════════════
   Blood Bowl Companion — js/settings.js
   localStorage-backed settings: global dice mode, per-wizard
   overrides, and future preferences.
   ═══════════════════════════════════════════════════════ */

const BB_SETTINGS_KEY = 'bb_settings';

const DEFAULTS = {
  diceMode:          'digital',   /* 'digital' | 'physical' */
  diceModeOverrides: {},          /* { wizardKey: 'digital' | 'physical' } */
  mode:              'veteran',   /* 'veteran' | 'beginner' */
};

function getSettings() {
  try {
    const raw = localStorage.getItem(BB_SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS, diceModeOverrides: {} };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      diceModeOverrides: parsed.diceModeOverrides ?? {},
    };
  } catch {
    return { ...DEFAULTS, diceModeOverrides: {} };
  }
}

function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  localStorage.setItem(BB_SETTINGS_KEY, JSON.stringify(s));
}

/** Returns 'digital' | 'physical' for a given wizard key. */
function getWizardDiceMode(wizardKey) {
  const s = getSettings();
  return s.diceModeOverrides?.[wizardKey] ?? s.diceMode;
}

window.BBSettings = { getSettings, saveSetting, getWizardDiceMode };
