/* board-model — soundboard state + persistence.
 *
 * Exposes the Phase A surface the UI already uses (model.board / selectedId /
 * getPad / movePad / resizePad / library / loadFromStorage / save / reset) AND
 * the Phase B additions (server boards + a client-side sound buffer cache).
 *
 * Buffers are client-only and NEVER serialized: a pad.sound is { id, name, size,
 * mime }; the AudioBuffer lives in buffers[sound.id], decoded from an uploaded
 * file or fetched from /api/sounds/<id> when a board is loaded. A sound whose
 * buffer can't be decoded (local-only id after a refresh) shows "re-attach".
 *
 * Persistence: server (signed in) is primary; localStorage is the signed-out
 * stopgap so the board still survives a refresh (D17).
 */
(function (root) {
  'use strict';

  var core = root.SoundBoard.core;
  var api = root.SBApi; // may be undefined in non-browser test contexts
  var LS_KEY = 'soundboard:v1';

  var state = {
    board: core.defaultBoard(),
    selectedId: null,
    serverId: null,          // board id on the server (null = local-only board)
    serverUpdatedAt: null,   // last server updatedAt (base for 409 detection)
    saving: false,
    saveError: null,
    readOnly: false,         // viewing a public board as a signed-out guest
    publicOwner: null,       // username of the public board's owner
  };
  var buffers = {};          // soundId -> AudioBuffer
  var library = [];          // session sounds: { id, name, size, mime, buffer? }

  function findPad(id) {
    for (var i = 0; i < state.board.pads.length; i++) if (state.board.pads[i].id === id) return state.board.pads[i];
    return null;
  }

  // --- buffer cache --------------------------------------------------------
  function getBuffer(id) { return id ? (buffers[id] || null) : null; }
  function setBuffer(id, buf) { if (id && buf) buffers[id] = buf; }
  function clearBuffers() { buffers = {}; }

  // --- board CRUD (delegates to core) ------------------------------------
  function addPad(opts) {
    if (state.readOnly) return null; // public board: play-only
    var p = core.addPad(state.board, opts); // throws when the board is full
    if (!state.selectedId) state.selectedId = p.id;
    return p;
  }
  function removePad(id) { if (state.readOnly) return; core.removePad(state.board, id); if (state.selectedId === id) state.selectedId = null; }
  function getPad(id) { return findPad(id); }
  function setSelected(id) { state.selectedId = id; }
  function movePad(id, x, y) { if (state.readOnly) return null; return core.movePad(state.board, id, x, y); }
  function resizePad(id, w, h) { if (state.readOnly) return null; return core.resizePad(state.board, id, w, h); }

  function renameBoard(name) { if (state.readOnly) return; state.board.name = name; }
  function setMaster(gain) { state.board.master.gain = gain; }
  function setPublic(v) { state.board.isPublic = !!v; }

  // --- session library ------------------------------------------------------
  function addLibrarySound(s) {
    if (s.buffer) setBuffer(s.id, s.buffer);
    for (var i = 0; i < library.length; i++) if (library[i].id === s.id) { library[i] = s; return s; }
    library.unshift(s);
    return s;
  }
  function removeLibrarySound(id) { for (var i = 0; i < library.length; i++) if (library[i].id === id) { library.splice(i, 1); break; } }
  function getLibrarySound(id) { for (var i = 0; i < library.length; i++) if (library[i].id === id) return library[i]; return null; }
  function listLibrary() { return library.slice(); }

  // --- serialize (sound = { id, name, size, mime }; buffer NEVER included) --
  function serialize() {
    var b = state.board;
    var pads = b.pads.map(function (p) {
      var s = p.sound;
      return {
        id: p.id, label: p.label, color: p.color, emoji: p.emoji, loop: p.loop,
        x: p.x, y: p.y, w: p.w, h: p.h, effects: p.effects,
        sound: s ? { id: s.id, name: s.name, size: s.size, mime: s.mime } : null,
      };
    });
    return { name: b.name, isPublic: b.isPublic, master: b.master, layout: b.layout, pads: pads };
  }

  // Replace the in-memory board with validated `data`. Buffers are untouched —
  // the caller hydrates them (local ids have none; server ids get fetched).
  function applyBoard(data) {
    state.board = core.validateBoard(data).board;
    state.selectedId = null;
  }

  // --- persistence ----------------------------------------------------------
  function save() {
    if (state.readOnly) return Promise.resolve({ ok: false, readOnly: true });
    if (state.serverId && api) return saveToServer();
    return saveToLocal();
  }
  function saveToLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(serialize()));
      state.saveError = null;
      return Promise.resolve({ ok: true, local: true });
    } catch (e) {
      state.saveError = 'Local save failed';
      return Promise.reject(e);
    }
  }
  function saveToServer() {
    state.saving = true;
    var payload = { name: state.board.name, isPublic: state.board.isPublic, data: serialize(), updatedAt: Date.now() };
    if (state.serverUpdatedAt) payload.baseUpdatedAt = state.serverUpdatedAt;
    return api.putBoard(state.serverId, payload)
      .then(function (res) {
        state.serverUpdatedAt = res && res.updatedAt ? res.updatedAt : Date.now();
        state.saveError = null;
        state.saving = false;
        return res;
      })
      .catch(function (e) {
        state.saveError = e && e.message ? e.message : 'Save failed';
        state.saving = false;
        throw e;
      });
  }

  function loadLocal() {
    var raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch {}
    if (!raw) { applyBoard(core.defaultBoard()); return false; }
    try { applyBoard(JSON.parse(raw)); return true; } catch { applyBoard(core.defaultBoard()); return false; }
  }
  function clearLocal() { try { localStorage.removeItem(LS_KEY); } catch {} }

  // --- server boards --------------------------------------------------------
  function listBoards() { return api.listBoards().then(function (d) { return d.boards || []; }); }
  function createBoard() {
    return api.createBoard().then(function (d) {
      return api.getBoard(d.id).then(function (g) {
        state.serverId = d.id;
        state.serverUpdatedAt = g.board.updatedAt;
        applyBoard(g.board.data);
        return d.id;
      });
    });
  }
  function loadBoard(id) {
    return api.getBoard(id).then(function (g) {
      state.serverId = id;
      state.serverUpdatedAt = g.board.updatedAt;
      applyBoard(g.board.data);
      return g.board;
    });
  }
  function loadPublicBoard(id) {
    return api.loadPublicBoard(id).then(function (g) {
      state.serverId = null;         // signed out \u2014 never save back
      state.readOnly = true;
      state.publicOwner = g.board.owner || null;
      applyBoard(g.board.data);
      return g.board;
    });
  }
  function deleteBoard(id) { return api.deleteBoard(id); }

  function reset() {
    state.board = core.defaultBoard();
    state.selectedId = null;
    state.serverId = null;
    state.serverUpdatedAt = null;
    state.readOnly = false;
    state.publicOwner = null;
    clearBuffers();
    library = [];
    state.saveError = null;
  }

  var model = {
    // legacy Phase A surface (the UI already calls these)
    get board() { return state.board; },
    get selectedId() { return state.selectedId; },
    getPad: getPad,
    setSelected: setSelected,
    addPad: addPad,
    removePad: removePad,
    movePad: movePad,
    resizePad: resizePad,
    get library() { return library; },
    addLibrarySound: addLibrarySound,
    removeLibrarySound: removeLibrarySound,
    getLibrarySound: getLibrarySound,
    listLibrary: listLibrary,
    loadFromStorage: loadLocal,
    clearStorage: clearLocal,
    save: save,
    reset: reset,
    // Phase B additions
    get serverId() { return state.serverId; },
    get saving() { return state.saving; },
    get saveError() { return state.saveError; },
    get readOnly() { return state.readOnly; },
    get publicOwner() { return state.publicOwner; },
    getBuffer: getBuffer,
    setBuffer: setBuffer,
    clearBuffers: clearBuffers,
    serialize: serialize,
    applyBoard: applyBoard,
    renameBoard: renameBoard,
    setMaster: setMaster,
    setPublic: setPublic,
    listBoards: listBoards,
    createBoard: createBoard,
    loadBoard: loadBoard,
    loadPublicBoard: loadPublicBoard,
    deleteBoard: deleteBoard,
  };

  root.SoundBoard = root.SoundBoard || {};
  root.SoundBoard.model = model;
})(typeof self !== 'undefined' ? self : this);
