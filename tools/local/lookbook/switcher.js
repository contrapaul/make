// ==========================================================================
// CSS Lookbook — Theme Switcher
// ========================================================================== 

(function () {
  const themeSheet = document.getElementById('theme-sheet');
  const buttons = document.querySelectorAll('.style-selector button[data-theme]');
  const body = document.body;

  // Available themes and their stylesheet paths
  const themes = {
    minimal: 'themes/minimal.css',
    neon: 'themes/neon.css',
    retro: 'themes/retro.css',
    brutalist: 'themes/brutalist.css',
    glassmorphism: 'themes/glassmorphism.css',
    paper: 'themes/paper.css'
  };

  /** Apply a theme by name */
  function applyTheme(name) {
    if (!themes[name]) return;

    // Swap stylesheet
    themeSheet.href = themes[name];

    // Update body class
    body.className = 'theme-' + name;

    // Highlight active button
    buttons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === name);
    });

    // Persist choice
    localStorage.setItem('lookbook-theme', name);
  }

  // Wire up button clicks
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyTheme(btn.dataset.theme);
    });
  });

  // Restore saved theme on load, default to minimal
  var saved = localStorage.getItem('lookbook-theme');
  if (saved && themes[saved]) {
    applyTheme(saved);
  } else {
    applyTheme('minimal');
  }
})();
