// ==UserScript==
// @name         Clio – Quick Pay (Check)
// @namespace    vmllp
// @version      2.1
// @description  Floating toolbar on Receive Payments: two paths (Operating / Expense), each sets Payment Source=Direct-Check, Deposit Account, Amount, then clicks Record Payment
// @author       Michael Volk
// @match        https://app.clio.com/nc/#/bills/receive_payments*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/clio-quick-pay.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/clio-quick-pay.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  const SOURCE_TEXT      = 'Direct - Check';
  const ACCT_OPERATING   = 'Operating Account';
  const ACCT_EXPENSE     = 'Expense Account';
  // ─────────────────────────────────────────────────────────────────────────

  // ── State ─────────────────────────────────────────────────────────────────
  let toolbar = null;
  let opAmtInput, expAmtInput;

  // ── DOM helpers ───────────────────────────────────────────────────────────

  function getKendoInput(placeholder) {
    return Array.from(document.querySelectorAll('input.k-input'))
      .find(i => i.placeholder === placeholder);
  }

  function getArrowBtn(kendoInput) {
    return kendoInput?.closest('span.k-combobox')?.querySelector('.k-select');
  }

  /**
   * Open a Kendo combobox and pick the option whose text matches `targetText`.
   * Returns a Promise that resolves true/false.
   */
  function selectKendoOption(placeholder, targetText) {
    return new Promise((resolve) => {
      const inp = getKendoInput(placeholder);
      if (!inp) return resolve(false);

      // Open the dropdown
      const arrow = getArrowBtn(inp);
      if (arrow) arrow.click();
      else { inp.focus(); inp.click(); inp.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }

      setTimeout(() => {
        // Find the right k-list-container — the one whose items match our target
        const containers = document.querySelectorAll('.k-list-container');
        let picked = false;
        for (const container of containers) {
          const items = container.querySelectorAll('.k-item');
          for (const item of items) {
            if (item.textContent.trim() === targetText) {
              item.click();
              picked = true;
              break;
            }
          }
          if (picked) break;
        }

        if (!picked) {
          // Close dropdown and report failure
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
        resolve(picked);
      }, 450);
    });
  }

  /**
   * Set a plain Angular input value and fire the events Angular needs.
   */
  function setAngularInput(nameAttr, value) {
    const inp = document.querySelector(`input[name="${nameAttr}"]`);
    if (!inp) return false;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeInputValueSetter) nativeInputValueSetter.call(inp, value);
    else inp.value = value;
    inp.dispatchEvent(new Event('input',  { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.dispatchEvent(new Event('blur',   { bubbles: true }));
    return true;
  }

  // ── Core flow ─────────────────────────────────────────────────────────────

  async function runPayment(depositAccount, amountValue, btn) {
    if (!amountValue || isNaN(parseFloat(amountValue))) {
      alert('Quick Pay: enter an amount first.');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Working…';

    try {
      // 1. Set Payment Source
      const srcOk = await selectKendoOption('Select payment source', SOURCE_TEXT);
      if (!srcOk) {
        alert(`Quick Pay: could not select "${SOURCE_TEXT}" as Payment Source.\nIs a client already selected?`);
        resetBtn(btn, depositAccount);
        return;
      }
      await sleep(300);

      // 2. Set Deposit Account
      const destOk = await selectKendoOption('Select deposit account', depositAccount);
      if (!destOk) {
        alert(`Quick Pay: could not select "${depositAccount}" as Deposit Account.`);
        resetBtn(btn, depositAccount);
        return;
      }
      await sleep(300);

      // 3. Set Amount
      const amtOk = setAngularInput('totalAmount', amountValue);
      if (!amtOk) {
        alert('Quick Pay: could not find the Payment Amount field.');
        resetBtn(btn, depositAccount);
        return;
      }
      await sleep(200);

      // 4. Click Record Payment
      const recordBtn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Record payment' && b.type === 'submit');
      if (!recordBtn) {
        alert('Quick Pay: could not find the "Record payment" button.');
        resetBtn(btn, depositAccount);
        return;
      }
      recordBtn.click();

      // Flash success
      btn.textContent = '✓ Done!';
      btn.style.background = '#28a745';
      setTimeout(() => resetBtn(btn, depositAccount), 2000);

    } catch (e) {
      alert('Quick Pay error: ' + e.message);
      resetBtn(btn, depositAccount);
    }
  }

  function resetBtn(btn, depositAccount) {
    btn.disabled = false;
    btn.style.background = depositAccount === ACCT_OPERATING ? '#0070d2' : '#6f42c1';
    btn.textContent = depositAccount === ACCT_OPERATING
      ? '💼 Operating'
      : '🧾 Expense';
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Toolbar UI ────────────────────────────────────────────────────────────

  function buildToolbar() {
    if (document.getElementById('tm-quickpay-toolbar')) return;

    // ── Outer pill ──
    const wrap = document.createElement('div');
    wrap.id = 'tm-quickpay-toolbar';
    Object.assign(wrap.style, {
      position:     'fixed',
      bottom:       '28px',
      right:        '24px',
      zIndex:       '99999',
      display:      'flex',
      flexDirection:'column',
      alignItems:   'flex-end',
      gap:          '8px',
      fontFamily:   'system-ui, sans-serif',
      fontSize:     '13px',
    });

    // ── Toggle FAB ──
    const fab = document.createElement('button');
    fab.id = 'tm-quickpay-fab';
    fab.textContent = '💳 Quick Pay';
    Object.assign(fab.style, {
      padding:      '10px 16px',
      background:   '#1a1a2e',
      color:        '#fff',
      border:       'none',
      borderRadius: '24px',
      fontWeight:   '700',
      fontSize:     '13px',
      cursor:       'pointer',
      boxShadow:    '0 3px 10px rgba(0,0,0,0.35)',
    });

    // ── Panel ──
    const panel = document.createElement('div');
    panel.id = 'tm-quickpay-panel';
    Object.assign(panel.style, {
      background:   '#1a1a2e',
      borderRadius: '14px',
      padding:      '14px',
      boxShadow:    '0 4px 20px rgba(0,0,0,0.4)',
      display:      'none',
      flexDirection:'column',
      gap:          '10px',
      minWidth:     '220px',
    });

    // helper: amount row
    function makeAmountRow(label, color) {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', flexDirection: 'column', gap: '4px' });

      const lbl = document.createElement('label');
      lbl.textContent = label;
      Object.assign(lbl.style, { color: '#aaa', fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em' });

      const inputRow = document.createElement('div');
      Object.assign(inputRow.style, { display: 'flex', gap: '6px', alignItems: 'center' });

      const amtInp = document.createElement('input');
      amtInp.type = 'number';
      amtInp.placeholder = '0.00';
      amtInp.step = '0.01';
      amtInp.min = '0';
      Object.assign(amtInp.style, {
        flex:         '1',
        padding:      '6px 8px',
        borderRadius: '8px',
        border:       '1px solid #444',
        background:   '#2a2a3e',
        color:        '#fff',
        fontSize:     '13px',
        outline:      'none',
      });

      const goBtn = document.createElement('button');
      goBtn.textContent = label.includes('Operating') ? '💼 Operating' : '🧾 Expense';
      Object.assign(goBtn.style, {
        padding:      '6px 10px',
        background:   color,
        color:        '#fff',
        border:       'none',
        borderRadius: '8px',
        fontWeight:   '700',
        cursor:       'pointer',
        whiteSpace:   'nowrap',
        fontSize:     '12px',
      });
      goBtn.addEventListener('mouseenter', () => goBtn.style.filter = 'brightness(1.2)');
      goBtn.addEventListener('mouseleave', () => goBtn.style.filter = '');

      const acct = label.includes('Operating') ? ACCT_OPERATING : ACCT_EXPENSE;
      goBtn.addEventListener('click', () => runPayment(acct, amtInp.value, goBtn));

      inputRow.appendChild(amtInp);
      inputRow.appendChild(goBtn);
      row.appendChild(lbl);
      row.appendChild(inputRow);

      return { row, amtInp };
    }

    const divider = document.createElement('hr');
    Object.assign(divider.style, { border: 'none', borderTop: '1px solid #333', margin: '0' });

    const { row: opRow, amtInp: opAmt } = makeAmountRow('Operating Account', '#0070d2');
    const { row: expRow, amtInp: expAmt } = makeAmountRow('Expense Account',  '#6f42c1');
    opAmtInput  = opAmt;
    expAmtInput = expAmt;

    // Source label
    const srcNote = document.createElement('div');
    srcNote.textContent = '✔ Source auto-set to: Direct - Check';
    Object.assign(srcNote.style, { color: '#888', fontSize: '10px', textAlign: 'center', marginTop: '2px' });

    panel.appendChild(opRow);
    panel.appendChild(divider);
    panel.appendChild(expRow);
    panel.appendChild(srcNote);

    // Toggle
    let open = false;
    fab.addEventListener('click', () => {
      open = !open;
      panel.style.display = open ? 'flex' : 'none';
      fab.textContent = open ? '✕ Close' : '💳 Quick Pay';
    });

    wrap.appendChild(panel);
    wrap.appendChild(fab);
    document.body.appendChild(wrap);
    toolbar = wrap;
  }

  function removeToolbar() {
    const t = document.getElementById('tm-quickpay-toolbar');
    if (t) t.remove();
    toolbar = null;
  }

  // ── SPA route watcher ─────────────────────────────────────────────────────

  function onRouteChange() {
    const onPage = location.hash.startsWith('#/bills/receive_payments');
    if (onPage && !document.getElementById('tm-quickpay-toolbar')) buildToolbar();
    else if (!onPage) removeToolbar();
  }

  window.addEventListener('hashchange', onRouteChange);
  window.addEventListener('popstate',   onRouteChange);

  // Persistent poller: rebuilds toolbar if Angular ever orphans it, handles slow SPA loads.
  // Runs every 600ms indefinitely — cheap check, just an getElementById.
  setInterval(onRouteChange, 600);

})();
