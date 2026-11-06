// ==UserScript==
// @name         Clio - Generate Bill Button
// @namespace    vmllp
// @version      1.2
// @description  On the Quick Bill page: clicks Show Options, checks Skip the bill approval process, then clicks Generate Bill. One button does it all.
// @author       Michael Volk
// @match        https://app.clio.com/*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/clio-generate-bill.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/clio-generate-bill.user.js
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Run only in the top window — the Quick Bill form lives in a same-origin
  // iframe, and without this guard the script injects a second button there.
  if (window.top !== window.self) return;

  const TOOLBAR_ID = 'tm-quickbill-toolbar';

  // ── Quick Bill form discovery ─────────────────────────────────────────────
  // The Quick Bill form may live in the top document or inside a same-origin
  // iframe, and the URL may or may not say "quick_bill" (Clio has been moving
  // pages off the old /nc/# hash routes). Detect by content, fall back to URL.

  function getDocs() {
    const docs = [document];
    for (const f of document.querySelectorAll('iframe')) {
      try {
        if (f.contentDocument) docs.push(f.contentDocument);
      } catch (e) { /* cross-origin iframe — skip */ }
    }
    return docs;
  }

  function findQuickBillDoc() {
    return getDocs().find(d =>
      d.querySelector('input.submit-quick-bill, #bills_approved, a.toggle-options'));
  }

  function urlSaysQuickBill() {
    return location.hash.includes('quick_bill') || location.pathname.includes('quick_bill');
  }

  function onQuickBillPage() {
    return !!findQuickBillDoc() || urlSaysQuickBill();
  }

  // ── Core flow ─────────────────────────────────────────────────────────────

  async function runQuickBill(btn) {
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Working…';

    try {
      const doc = findQuickBillDoc();
      if (!doc) throw new Error('Quick Bill form not found on this page.');

      // 1. Click "Show options" if options are currently hidden
      const toggleLink = doc.querySelector('a.toggle-options');
      if (toggleLink && /show.?option/i.test(toggleLink.textContent)) {
        toggleLink.click();
        await sleep(500);
      }

      // 2. Ensure "Skip the bill approval process" is checked
      const skipCheck = doc.querySelector('input#bills_approved');
      if (!skipCheck) throw new Error('"Skip the bill approval process" checkbox not found.');
      if (!skipCheck.checked) {
        skipCheck.click();
        await sleep(200);
      }

      // 3. Click Generate Bill
      const generateBtn = doc.querySelector('input.submit-quick-bill')
        || Array.from(doc.querySelectorAll('button, input[type="submit"]'))
             .find(b => /generate bill/i.test(b.textContent || b.value || ''));
      if (!generateBtn) throw new Error('"Generate Bill" button not found.');
      generateBtn.click();

      btn.textContent = '✓ Done!';
      btn.style.background = '#28a745';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = origText;
        btn.style.background = '#1a1a2e';
      }, 2500);

    } catch (e) {
      alert('Quick Bill error: ' + e.message);
      btn.disabled = false;
      btn.textContent = origText;
      btn.style.background = '#1a1a2e';
    }
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Toolbar UI ────────────────────────────────────────────────────────────

  function buildToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return;

    const wrap = document.createElement('div');
    wrap.id = TOOLBAR_ID;
    Object.assign(wrap.style, {
      position:   'fixed',
      right:      '24px',
      top:        '72px',
      zIndex:     '2147483647',
      fontFamily: 'system-ui, sans-serif',
    });

    const btn = document.createElement('button');
    btn.textContent = '⚡ Generate Bill';
    Object.assign(btn.style, {
      padding:      '8px 16px',
      background:   '#1a1a2e',
      color:        '#fff',
      border:       '2px solid #0070d2',
      borderRadius: '20px',
      fontWeight:   '700',
      fontSize:     '13px',
      cursor:       'pointer',
      whiteSpace:   'nowrap',
      boxShadow:    '0 2px 8px rgba(0,0,0,0.4)',
    });
    btn.addEventListener('mouseenter', () => { if (!btn.disabled) btn.style.background = '#0070d2'; });
    btn.addEventListener('mouseleave', () => { if (!btn.disabled) btn.style.background = '#1a1a2e'; });
    btn.addEventListener('click', () => runQuickBill(btn));

    wrap.appendChild(btn);
    document.documentElement.appendChild(wrap);
  }

  function removeToolbar() {
    document.getElementById(TOOLBAR_ID)?.remove();
  }

  // ── Persistent route watcher ──────────────────────────────────────────────
  // Same pattern as the working Quick Pay script: poll forever, cheap check.

  function checkRoute() {
    if (onQuickBillPage()) buildToolbar();
    else removeToolbar();
  }

  window.addEventListener('hashchange', checkRoute);
  window.addEventListener('popstate',   checkRoute);
  setInterval(checkRoute, 600);

})();
