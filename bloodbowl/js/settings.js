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
  gameMode:          'seasoned',  /* 'first' | 'seasoned' | 'pro' */
  trackTurns:        true,        /* Professional mode: per-turn action tracking on/off */
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
  if (!modeAllows('physicalDice')) return 'digital';   /* First Match is fully digital */
  const s = getSettings();
  return s.diceModeOverrides?.[wizardKey] ?? s.diceMode;
}

/** Single gate for game-mode-dependent features. */
function modeAllows(feature) {
  const s = getSettings();
  switch (feature) {
    case 'physicalDice': return s.gameMode !== 'first';
    case 'turnTracking': return s.gameMode === 'pro' ? !!s.trackTurns : true;
    case 'tutorial':     return s.gameMode === 'first';
    default:             return true;
  }
}

function setGameMode(mode) {
  saveSetting('gameMode', mode);
  document.dispatchEvent(new CustomEvent('bb:gameMode', { detail: { mode } }));
}

window.BBSettings = { getSettings, saveSetting, getWizardDiceMode, modeAllows, setGameMode };
