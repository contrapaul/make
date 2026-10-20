/* Soundboard UI — the signed-in user's server boards: "+ New board" and the list
 * of boards to switch between (edit panel). */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var model = S.model;
  var api = root.SBApi;
  var D = S.dom;
  var make = D.make, section = D.section, hintBox = D.hintBox;

  // Calls into sibling modules, resolved at call time so load order is free.
  function render() { S.ui.render(); }
  function lcdMsg(t) { S.ui.lcdMsg(t); }
  function lcdError(t) { S.ui.lcdError(t); }
  function hydrateSounds() { return S.library.hydrateSounds(); }

  // ---- boards (server) -----------------------------------------------------
  function boardsSection() {
    if (!(api && api.user)) {
      return section('Boards', [hintBox('Sign in (top right) to create boards and save them to your account.')]);
    }
    var newBtn = make('button', { type: 'button', class: 'sb-btn', text: '+ New board', onclick: function () {
      model.createBoard()
        .then(function () { return hydrateSounds(); })
        .then(function () { render(); lcdMsg('New board created'); })
        .catch(function (e) { lcdError((e && e.message) || 'Could not create board'); });
    }});
    var listEl = make('div', { class: 'sb-boards' });
    listEl.appendChild(hintBox('Loading boards\u2026'));
    refreshBoardList(listEl);
    return section('Boards', [make('div', { class: 'sb-row' }, [newBtn]), listEl]);
  }
  function refreshBoardList(el) {
    el.innerHTML = '';
    model.listBoards().then(function (boards) {
      if (!boards.length) { el.appendChild(hintBox('No boards yet \u2014 create one.')); return; }
      boards.forEach(function (b) {
        var active = model.serverId === b.id;
        var item = make('div', { class: 'board-item' + (active ? ' is-active' : '') }, [
          make('span', { class: 'board-item__name', text: b.name }),
          make('button', { type: 'button', class: 'sb-btn', text: active ? 'Current' : 'Load', 'disabled': active ? 'disabled' : null, 'aria-label': active ? 'Current board: ' + b.name : 'Load board ' + b.name, onclick: function () {
            if (active) return;
            model.loadBoard(b.id)
              .then(function () { return hydrateSounds(); })
              .then(function () { render(); lcdMsg('Loaded board'); })
              .catch(function (e) { lcdError((e && e.message) || 'Could not load board'); });
          }}),
        ]);
        el.appendChild(item);
      });
    }).catch(function (e) {
      el.innerHTML = '';
      el.appendChild(hintBox('Could not load boards' + (e && e.message ? ': ' + e.message : '')));
    });
  }

  root.SoundBoard.boards = { boardsSection: boardsSection };
})(typeof self !== 'undefined' ? self : this);
