// ==UserScript==
// @name         Clio - Record Payments Button
// @namespace    vmllp
// @version      5.2
// @description  Quick Pay panel beside the Receive Payments form: balance buttons (Operating/Expense, Clio autofills amount) plus custom-amount rows; sets Payment Source=Direct-Check, Deposit Account, then clicks Record Payment
// @author       Michael Volk
// @match        https://app.clio.com/nc/*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/clio-quick-pay.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/clio-quick-pay.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SOURCE_TEXT    = 'Direct - Check';
  const ACCT_OPERATING = 'Operating Account';
  const ACCT_EXPENSE   = 'Expense Account';
  const TOOLBAR_ID     = 'tm-quickpay-toolbar';

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function getKendoInput(placeholder) {
    return Array.from(document.querySelectorAll('input.k-input')).find(i => i.placeholder === placeholder);
  }

  function selectKendoOption(placeholder, targetText) {
    return new Promise((resolve) => {
      const inp = getKendoInput(placeholder);
      if (!inp) return resolve(false);
      const arrow = inp.closest('span.k-combobox')?.querySelector('.k-select');
      if (arrow) arrow.click();
      else { inp.focus(); inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
      setTimeout(() => {
        let picked = false;
        for (const container of document.querySelectorAll('.k-list-container')) {
          for (const item of container.querySelectorAll('.k-item')) {
            if (item.textContent.trim() === targetText) { item.click(); picked = true; break; }
          }
          if (picked) break;
        }
        if (!picked) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        resolve(picked);
      }, 500);
    });
  }

  function setAngularInput(nameAttr, value) {
    const inp = document.querySelector(`input[name="${nameAttr}"]`);
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(inp, value); else inp.value = value;
    ['input', 'change', 'blur'].forEach(e => inp.dispatchEvent(new Event(e, { bubbles: true })));
    return true;
  }

  /**
   * Run the payment flow. If `amountValue` is null, the amount step is skipped
   * so Clio's own autofill (the outstanding balance) is kept.
   */
  async function runPayment(depositAccount, amountValue, btn) {
    const useBalance = amountValue === null;
    if (!useBalance && (!amountValue || isNaN(parseFloat(amountValue)))) {
      alert('Quick Pay: enter an amount first.');
      return;
    }
    const origText = btn.textContent;
    const origBg   = btn.style.background;
    btn.disabled = true; btn.textContent = '⏳…';
    try {
      const srcOk  = await selectKendoOption('Select payment source', SOURCE_TEXT);  await sleep(350);
      const destOk = await selectKendoOption('Select deposit account', depositAccount); await sleep(350);
      // In balance mode, leave the amount Clio autofilled after picking the account
      const amtOk  = useBalance ? true : setAngularInput('totalAmount', amountValue); await sleep(200);
      const recordBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Record payment' && b.type === 'submit');
      if (!srcOk || !destOk || !amtOk || !recordBtn) {
        alert(`Quick Pay issue:\nSource: ${srcOk}\nDest: ${destOk}\nAmount: ${amtOk}\nRecord btn: ${!!recordBtn}`);
        btn.disabled = false; btn.textContent = origText; btn.style.background = origBg; return;
      }
      recordBtn.click();
      btn.textContent = '✓ Done!'; btn.style.background = '#28a745';
      setTimeout(() => { btn.disabled = false; btn.textContent = origText; btn.style.background = origBg; }, 2000);
    } catch(e) {
      alert('Quick Pay error: ' + e.message);
      btn.disabled = false; btn.textContent = origText; btn.style.background = origBg;
    }
  }

  function positionToolbar() {
    const wrap = document.getElementById(TOOLBAR_ID);
    if (!wrap) return;
    const srcInput = getKendoInput('Select payment source');
    if (!srcInput) {
      // Field not visible yet (no client selected) — retry shortly
      setTimeout(positionToolbar, 500);
      return;
    }
    const srcRect = (srcInput.closest('span.k-combobox') || srcInput).getBoundingClientRect();
    wrap.style.right  = '';
    wrap.style.left   = (srcRect.right + 24) + 'px';
    wrap.style.top    = (srcRect.top + (srcRect.height / 2) - 18) + 'px';
  }

  function buildToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return;


    const wrap = document.createElement('div');
    wrap.id = TOOLBAR_ID;
    // Pre-set left/top to 0 so it's never in an undefined position
    Object.assign(wrap.style, {
      position:   'fixed',
      left:       '0px',
      top:        '0px',
      right:      '',
      zIndex:     '2147483647',
      fontFamily: 'system-ui, sans-serif',
      fontSize:   '13px',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position:      'absolute',
      top:           '38px',
      left:          '0',
      background:    '#1a1a2e',
      borderRadius:  '14px',
      padding:       '14px',
      boxShadow:     '0 4px 20px rgba(0,0,0,0.6)',
      display:       'none',
      flexDirection: 'column',
      gap:           '10px',
      width:         '280px',
    });

    function makeRow(label, color, acct) {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', flexDirection: 'column', gap: '4px' });
      const lbl = document.createElement('div');
      lbl.textContent = label;
      Object.assign(lbl.style, { color: '#aaa', fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em' });
      const inputRow = document.createElement('div');
      Object.assign(inputRow.style, { display: 'flex', gap: '6px', alignItems: 'center' });
      const amtInp = document.createElement('input');
      amtInp.type = 'number'; amtInp.placeholder = '0.00'; amtInp.step = '0.01';
      Object.assign(amtInp.style, {
        flex: '1', padding: '6px 8px', borderRadius: '8px', border: '1px solid #555',
        background: '#2a2a3e', color: '#fff', fontSize: '13px', outline: 'none',
      });
      const goBtn = document.createElement('button');
      goBtn.textContent = acct === ACCT_OPERATING ? '💼 Operating' : '🧾 Expense';
      Object.assign(goBtn.style, {
        padding: '6px 12px', background: color, color: '#fff', border: 'none',
        borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap'
      });
      goBtn.addEventListener('click', () => runPayment(acct, amtInp.value, goBtn));
      inputRow.appendChild(amtInp); inputRow.appendChild(goBtn);
      row.appendChild(lbl); row.appendChild(inputRow);
      return row;
    }

    // Balance button: no amount — Clio autofills the outstanding balance
    function makeBalanceBtn(label, color, acct) {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        flex: '1', padding: '8px 10px', background: color, color: '#fff', border: 'none',
        borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap'
      });
      b.addEventListener('click', () => runPayment(acct, null, b));
      return b;
    }

    function makeDivider(text) {
      const d = document.createElement('div');
      Object.assign(d.style, { display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' });
      const line1 = document.createElement('hr');
      const line2 = document.createElement('hr');
      [line1, line2].forEach(l => Object.assign(l.style, { flex: '1', border: 'none', borderTop: '1px solid #333', margin: '0' }));
      if (text) {
        const t = document.createElement('span');
        t.textContent = text;
        Object.assign(t.style, { color: '#666', fontSize: '10px', fontWeight: '600', letterSpacing: '0.05em' });
        d.appendChild(line1); d.appendChild(t); d.appendChild(line2);
      } else {
        d.appendChild(line1); d.appendChild(line2);
      }
      return d;
    }

    // ── Balance section ──
    const balLbl = document.createElement('div');
    balLbl.textContent = 'PAY FULL BALANCE';
    Object.assign(balLbl.style, { color: '#aaa', fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em' });
    const balRow = document.createElement('div');
    Object.assign(balRow.style, { display: 'flex', gap: '6px' });
    balRow.appendChild(makeBalanceBtn('💼 Operating', '#0070d2', ACCT_OPERATING));
    balRow.appendChild(makeBalanceBtn('🧾 Expense',   '#6f42c1', ACCT_EXPENSE));

    const note = document.createElement('div');
    note.textContent = '✔ Source: Direct - Check';
    Object.assign(note.style, { color: '#555', fontSize: '10px', textAlign: 'center', marginTop: '2px' });

    panel.appendChild(balLbl);
    panel.appendChild(balRow);
    panel.appendChild(makeDivider('CUSTOM AMOUNT'));
    panel.appendChild(makeRow('Operating Account', '#0070d2', ACCT_OPERATING));
    panel.appendChild(makeDivider(''));
    panel.appendChild(makeRow('Expense Account', '#6f42c1', ACCT_EXPENSE));
    panel.appendChild(note);

    const fab = document.createElement('button');
    fab.textContent = '💳 Quick Pay';
    Object.assign(fab.style, {
      padding:      '6px 14px',
      background:   '#1a1a2e',
      color:        '#fff',
      border:       '2px solid #444',
      borderRadius: '20px',
      fontWeight:   '700',
      fontSize:     '12px',
      cursor:       'pointer',
      whiteSpace:   'nowrap',
      boxShadow:    '0 2px 8px rgba(0,0,0,0.3)',
    });

    let open = false;
    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      open = !open;
      panel.style.display = open ? 'flex' : 'none';
      fab.textContent = open ? '✕ Close' : '💳 Quick Pay';
    });
    document.addEventListener('click', (e) => {
      if (open && !wrap.contains(e.target)) {
        open = false; panel.style.display = 'none'; fab.textContent = '💳 Quick Pay';
      }
    }, true);

    wrap.appendChild(panel);
    wrap.appendChild(fab);
    document.documentElement.appendChild(wrap);

    // Position immediately, then again after layout settles
    positionToolbar();
    requestAnimationFrame(() => {
      positionToolbar();
      setTimeout(positionToolbar, 200);
      setTimeout(positionToolbar, 600);
    });

    window.addEventListener('scroll', positionToolbar, { passive: true });
    window.addEventListener('resize', positionToolbar, { passive: true });
  }

  function removeToolbar() {
    document.getElementById(TOOLBAR_ID)?.remove();
  }

  function checkRoute() {
    const onPage = location.hash.startsWith('#/bills/receive_payments');
    if (onPage) buildToolbar();
    else removeToolbar();
  }

  window.addEventListener('hashchange', checkRoute);

  const observer = new MutationObserver(() => {
    if (location.hash.startsWith('#/bills/receive_payments') && !document.getElementById(TOOLBAR_ID)) {
      buildToolbar();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: false });

  // Boot — wait for the Angular app shell to render, then check route
  // Don't gate on the payment source field — it only appears after a client is selected
  let polls = 0;
  const init = setInterval(() => {
    if (document.querySelector('.payments-modal, input[name="client_input"], [class*="receive-payment"]')) {
      checkRoute();
      clearInterval(init);
    } else if (++polls > 60) {
      clearInterval(init);
    }
  }, 500);

})();
