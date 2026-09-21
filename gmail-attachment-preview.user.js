// ==UserScript==
// @name         Gmail - Preview Attachment Before Sending
// @namespace    vmllp
// @version      1.0
// @description  Click an attachment in a Gmail compose window to view it in an overlay instead of downloading it. Captures the file as you attach it, so it never depends on Gmail's internal attachment URLs.
// @author       Michael Volk
// @match        https://mail.google.com/*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/gmail-attachment-preview.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/gmail-attachment-preview.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const DB_NAME   = 'vm_gmail_attachment_preview';
  const STORE     = 'files';
  const KEEP_MS   = 7 * 24 * 60 * 60 * 1000;  // how long a captured file stays previewable
  const MAX_BYTES = 40 * 1024 * 1024;         // don't stash anything bigger than this
  // ─────────────────────────────────────────────────────────────────────────

  // ── Captured files ────────────────────────────────────────────────────────
  // Gmail gives us no reliable handle on a draft's attachment, so we keep our
  // own copy of every file the moment it is attached (picker, drag-drop, paste)
  // and render the preview from that.

  const byKey  = new Map();   // "name|size" -> File
  const byName = new Map();   // "name"      -> File

  const keyOf = (name, size) => name + '|' + size;

  function remember(file) {
    if (!file || !file.name || file.size > MAX_BYTES) return;
    byKey.set(keyOf(file.name, file.size), file);
    byName.set(file.name, file);
    persist(file);
  }

  // ── IndexedDB (so a draft left overnight still previews) ──────────────────

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function persist(file) {
    try {
      const db = await openDB();
      db.transaction(STORE, 'readwrite').objectStore(STORE).put({
        key:  keyOf(file.name, file.size),
        name: file.name,
        size: file.size,
        type: file.type,
        blob: file,
        at:   Date.now()
      });
    } catch (err) {
      console.warn('[Attachment Preview] could not persist', file.name, err);
    }
  }

  async function restore() {
    try {
      const db  = await openDB();
      const all = await new Promise((resolve, reject) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror   = () => reject(r.error);
      });

      const cutoff = Date.now() - KEEP_MS;
      const stale  = [];
      for (const rec of all) {
        if (!rec.blob || rec.at < cutoff) { stale.push(rec.key); continue; }
        const file = new File([rec.blob], rec.name, { type: rec.type });
        byKey.set(rec.key, file);
        byName.set(rec.name, file);
      }

      if (stale.length) {
        const os = db.transaction(STORE, 'readwrite').objectStore(STORE);
        stale.forEach((k) => os.delete(k));
      }
    } catch (err) {
      console.warn('[Attachment Preview] could not restore cache', err);
    }
  }

  restore();

  // ── Capture every file on its way into a draft ───────────────────────────

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.tagName === 'INPUT' && t.type === 'file' && t.files) {
      Array.from(t.files).forEach(remember);
    }
  }, true);

  document.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files) Array.from(files).forEach(remember);
  }, true);

  document.addEventListener('paste', (e) => {
    const files = e.clipboardData && e.clipboardData.files;
    if (files) Array.from(files).forEach(remember);
  }, true);

  // ── Finding the attachment chip under the cursor ─────────────────────────
  // Matching on the filename text rather than on Gmail's class names, which
  // change without notice.

  const SIZE_SUFFIX = /\s*\(\s*[\d.]+\s*[KMG]?B?\s*\)\s*$/i;

  const SLACK = 40;   // room for a chip's size label, remove glyph, etc.

  function fileForText(raw) {
    if (!raw) return null;
    const text = raw.trim();
    if (!text || text.length > 260) return null;

    if (byName.has(text)) return byName.get(text);

    const stripped = text.replace(SIZE_SUFFIX, '').trim();   // "report.pdf (22K)"
    if (byName.has(stripped)) return byName.get(stripped);

    // A chip wrapper often reads "report.pdf(22K)x" — still that one file, as
    // long as there is not enough extra text for it to be something else.
    for (const [name, file] of byName) {
      if (text.length <= name.length + SLACK && text.indexOf(name) !== -1) return file;
    }
    return null;
  }

  function chipUnder(node) {
    if (!node || !node.textContent) return null;

    // Never touch the message body or a field being typed in — a filename
    // mentioned in the draft text must stay ordinary, clickable text.
    if (node.closest && node.closest('[contenteditable="true"], input, textarea')) return null;

    // Clicking the remove "x" or the file-type icon gives us little or no text;
    // bail on those so Gmail's own handlers still run.
    if (node.textContent.trim().length < 3) return null;

    for (let el = node; el && el !== document.body; el = el.parentElement) {
      const label = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('data-tooltip'))) || '';
      if (/remove|delete|close/i.test(label)) return null;
      const file = fileForText(el.textContent);
      if (file) return { el: el, file: file };
    }
    return null;
  }

  // Hovering tags the chip so it is visibly clickable — cheaper and far less
  // brittle than observing Gmail's DOM for chips as they appear.
  document.addEventListener('mouseover', (e) => {
    const hit = chipUnder(e.target);
    if (!hit || hit.el.dataset.vmPreview) return;
    hit.el.dataset.vmPreview = '1';
    hit.el.title = 'Click to preview — ' + hit.file.name;
    hit.el.style.cursor = 'zoom-in';
  }, true);

  document.addEventListener('click', (e) => {
    const hit = chipUnder(e.target);
    if (!hit) return;                       // not ours: let Gmail download as usual
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openViewer(hit.file);
  }, true);

  // ── Viewer ────────────────────────────────────────────────────────────────

  const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];
  const TEXT_EXT  = ['txt', 'csv', 'md', 'json', 'xml', 'log', 'eml', 'html', 'htm'];

  let overlay = null;
  let liveURL = null;

  function extOf(name) {
    const i = name.lastIndexOf('.');
    return i === -1 ? '' : name.slice(i + 1).toLowerCase();
  }

  function humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function injectStyles() {
    if (document.getElementById('vm-attach-preview-css')) return;
    const style = document.createElement('style');
    style.id = 'vm-attach-preview-css';
    style.textContent = [
      '#vm-attach-preview{position:fixed;inset:0;z-index:2147483647;background:rgba(15,17,20,.82);',
      'display:flex;align-items:center;justify-content:center;font-family:Roboto,Arial,sans-serif}',
      '#vm-attach-preview .vm-shell{width:min(1100px,94vw);height:92vh;background:#fff;border-radius:10px;',
      'display:flex;flex-direction:column;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.5)}',
      '#vm-attach-preview .vm-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f1f3f4;',
      'border-bottom:1px solid #dadce0;flex:0 0 auto}',
      '#vm-attach-preview .vm-name{font-size:14px;font-weight:600;color:#202124;white-space:nowrap;overflow:hidden;',
      'text-overflow:ellipsis;flex:1 1 auto}',
      '#vm-attach-preview .vm-meta{font-size:12px;color:#5f6368;flex:0 0 auto}',
      '#vm-attach-preview button{font:inherit;font-size:13px;border:1px solid #dadce0;background:#fff;color:#202124;',
      'border-radius:4px;padding:6px 12px;cursor:pointer;flex:0 0 auto}',
      '#vm-attach-preview button:hover{background:#e8eaed}',
      '#vm-attach-preview .vm-close{border:none;background:transparent;font-size:20px;line-height:1;padding:4px 8px}',
      '#vm-attach-preview .vm-body{flex:1 1 auto;overflow:auto;background:#525659;display:flex;',
      'align-items:center;justify-content:center}',
      '#vm-attach-preview iframe{width:100%;height:100%;border:0;background:#fff}',
      '#vm-attach-preview img{max-width:100%;max-height:100%;object-fit:contain}',
      '#vm-attach-preview pre{margin:0;padding:20px;width:100%;overflow:auto;background:#fff;',
      'color:#202124;font:13px/1.5 Consolas,monospace;white-space:pre-wrap;word-break:break-word;align-self:stretch}',
      '#vm-attach-preview .vm-note{color:#e8eaed;font-size:14px;text-align:center;padding:40px;line-height:1.6}'
    ].join('');
    document.head.appendChild(style);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); closeViewer(); }
  }

  function closeViewer() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (liveURL) { URL.revokeObjectURL(liveURL); liveURL = null; }
    document.removeEventListener('keydown', onKey, true);
  }

  function openViewer(file) {
    injectStyles();
    closeViewer();

    liveURL = URL.createObjectURL(file);
    const ext = extOf(file.name);

    overlay = document.createElement('div');
    overlay.id = 'vm-attach-preview';
    overlay.innerHTML =
      '<div class="vm-shell">' +
        '<div class="vm-bar">' +
          '<span class="vm-name"></span>' +
          '<span class="vm-meta"></span>' +
          '<button class="vm-tab">Open in new tab</button>' +
          '<button class="vm-dl">Download</button>' +
          '<button class="vm-close" title="Close (Esc)">&times;</button>' +
        '</div>' +
        '<div class="vm-body"></div>' +
      '</div>';

    overlay.querySelector('.vm-name').textContent = file.name;
    overlay.querySelector('.vm-meta').textContent = humanSize(file.size);

    const body = overlay.querySelector('.vm-body');

    if (ext === 'pdf' || file.type === 'application/pdf') {
      const frame = document.createElement('iframe');
      frame.src = liveURL;
      body.appendChild(frame);
    } else if (IMAGE_EXT.indexOf(ext) !== -1) {
      const img = document.createElement('img');
      img.src = liveURL;
      body.appendChild(img);
    } else if (TEXT_EXT.indexOf(ext) !== -1) {
      const pre = document.createElement('pre');
      pre.textContent = 'Loading…';
      body.appendChild(pre);
      file.text().then((t) => { pre.textContent = t; });
    } else {
      const note = document.createElement('div');
      note.className = 'vm-note';
      note.textContent = (ext ? ext.toUpperCase() + ' files' : 'This file type') +
        ' cannot be shown inline. Use Open in new tab or Download to check it.';
      body.appendChild(note);
    }

    overlay.querySelector('.vm-close').addEventListener('click', closeViewer);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeViewer(); });

    overlay.querySelector('.vm-tab').addEventListener('click', () => {
      window.open(liveURL, '_blank', 'noopener');
    });

    overlay.querySelector('.vm-dl').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = liveURL;
      a.download = file.name;
      a.click();
    });

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
  }
})();
