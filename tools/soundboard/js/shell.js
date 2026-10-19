/* Soundboard shell — boots the UI once the DOM is ready. */
(function (root) {
  'use strict';
  function boot() {
    if (root.SoundBoard && root.SoundBoard.ui) root.SoundBoard.ui.init();
  }
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof self !== 'undefined' ? self : this);
