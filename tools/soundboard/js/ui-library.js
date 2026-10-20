/* Soundboard UI — sound library: load/upload files, assign clips to pads, and
 * hydrate (fetch + decode) the sounds a loaded board references. */
(function (root) {
  'use strict';

  var S = root.SoundBoard;
  var core = S.core;
  var model = S.model;
  var engine = S.engine;
  var api = root.SBApi;
  var D = S.dom;
  var $ = D.$, make = D.make;
  var section = D.section, hintBox = D.hintBox;

  var MAX_FILE = 2 * 1024 * 1024; // 2MB, per blueprint Q4
  var AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i;

  // Calls into sibling modules, resolved at call time so load order is free.
  function render() { S.ui.render(); }
  function lcdMsg(t) { S.ui.lcdMsg(t); }
  function lcdError(t) { S.ui.lcdError(t); }

  function isAudioFile(f) {
    if (!f) return false;
    return (f.type && f.type.indexOf('audio/') === 0) || AUDIO_EXT.test(f.name || '');
  }
  // ---- library section (edit mode) -----------------------------------------
  function librarySection() {
    var add = make('button', { type: 'button', class: 'sb-btn', text: '+ Load audio file', onclick: openFilePicker });
    var sec; // the recorder (e01s10) opens in place of this whole section
    var recBtn = S.recorderUI.recordButton(function () { return sec; });
    var list = make('div', { class: 'sb-lib' });
    if (!model.library.length) {
      list.appendChild(hintBox('No clips yet. Load a file (max 2 MB); it appears here for any pad.'));
    } else {
      model.library.forEach(function (s) {
        var target = model.getPad(model.selectedId);
        var item = make('div', { class: 'lib-item' }, [
          make('div', { class: 'lib-item__meta' }, [
            make('span', { class: 'lib-item__name', text: s.name }),
            make('span', { class: 'lib-item__size', text: (s.size / 1024).toFixed(0) + ' KB' }),
          ]),
          make('button', { type: 'button', class: 'sb-btn', text: target ? 'Assign' : 'Pick pad', onclick: function () { assignToPad(s); } }),
          make('button', { type: 'button', class: 'sb-btn sb-btn--warn', text: '\u00d7', title: 'Remove', 'aria-label': 'Remove ' + s.name + ' from library', onclick: function () { model.removeLibrarySound(s.id); render(); } }),
        ]);
        list.appendChild(item);
      });
    }
    sec = section('Library', [make('div', { class: 'sb-row' }, [add, recBtn]), list]);
    return sec;
  }

  function assignToPad(s) {
    var target = model.getPad(model.selectedId);
    if (!target) { lcdError('Select a pad on the grid first, then assign'); return; }
    padSoundAssign(target, s);
    render();
    lcdMsg('Assigned "' + s.name + '" to ' + target.label);
  }
  function padSoundAssign(pad, s) {
    // Buffer stays in the model cache; the pad stores only serializable meta.
    if (s.buffer) model.setBuffer(s.id, s.buffer);
    pad.sound = { id: s.id, name: s.name, size: s.size, mime: s.mime || (s.type || 'audio') };
  }

  function openFilePicker() { $('#sb-file').click(); }

  function onFile(files) {
    var file = files && files[0];
    if (!file) return;
    if (file.size > MAX_FILE) { lcdError('File too large \u2014 max 2 MB'); return; }
    if (!isAudioFile(file)) { lcdError('That doesn\u2019t look like an audio file'); return; }
    var mime = file.type || 'audio';
    var target = model.getPad(model.selectedId);

    if (api && api.user) {
      // Signed in: upload to the server AND decode locally for instant playback.
      lcdMsg('Uploading "' + file.name + '" \u2026');
      Promise.all([engine.decode(file), api.uploadSound(file, file.name, mime)])
        .then(function (res) {
          var buffer = res[0];
          var meta = res[1]; // { id, name, size, mime }
          model.setBuffer(meta.id, buffer);
          var s = model.addLibrarySound(meta);
          if (target) padSoundAssign(target, s);
          render();
          lcdMsg('Uploaded "' + meta.name + '"' + (target ? ' \u2192 ' + target.label : ''));
        })
        .catch(function (err) {
          lcdError((err && err.message) ? ('Upload failed: ' + err.message) : 'Upload failed');
        });
    } else {
      // Signed out: decode locally only \u2014 the clip lives in this session (Phase A).
      lcdMsg('Decoding \u2026');
      engine.decode(file).then(function (buffer) {
        var s = model.addLibrarySound({ id: core.uid('s_'), name: file.name, size: file.size, mime: mime, buffer: buffer });
        if (target) padSoundAssign(target, s);
        render();
        lcdMsg('Loaded "' + file.name + '"' + (target ? ' \u2192 ' + target.label : '') + ' \u00b7 local (sign in to save)');
      }).catch(function (err) {
        lcdError('Could not decode audio' + (err && err.message ? ': ' + err.message : ''));
      });
    }
  }


  // ---- hydrate: fetch + decode the sounds a loaded board references ---------
  function hydrateSounds() {
    var seen = {};
    model.board.pads.forEach(function (p) { if (p.sound && p.sound.id) seen[p.sound.id] = true; });
    var jobs = Object.keys(seen).map(function (id) {
      if (model.getBuffer(id)) return Promise.resolve();
      return fetch(api.soundUrl(id))
        .then(function (r) { if (!r.ok) throw new Error('nf'); return r.blob().then(function (b) { return engine.decode(b); }); })
        .then(function (buf) { model.setBuffer(id, buf); })
        .catch(function () { /* local id or missing: leave for re-attach */ });
    });
    return Promise.all(jobs);
  }

  root.SoundBoard.library = {
    librarySection: librarySection, assignToPad: assignToPad, padSoundAssign: padSoundAssign,
    openFilePicker: openFilePicker, onFile: onFile, hydrateSounds: hydrateSounds,
  };
})(typeof self !== 'undefined' ? self : this);
