// ==UserScript==
// @name         QBO - Print Checks Screen - Account Quick Select
// @namespace    https://github.com/mdvolkjr
// @version      1.2
// @description  Adds IOLTA / Expense / Ops buttons to the Print Checks header bar to quickly switch the Account dropdown
// @match        https://qbo.intuit.com/*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/QBO%20-%20Print%20Checks%20Screen%20-%20Account%20Quick%20Select.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/QBO%20-%20Print%20Checks%20Screen%20-%20Account%20Quick%20Select.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Unique text for each account as it appears in the dropdown list (matched
  // anywhere in the option text). Update these if the account names change in QBO.
  const ACCOUNTS = [
    { key: 'IOLTA', label: 'IOLTA', match: 'IOLTA' },
    { key: 'EXPENSE', label: 'Expense', match: 'Expense Account' },
    { key: 'OPS', label: 'Ops', match: 'Operating Account' },
  ];

  const BTN_BAR_ID = 'tm-qbo-account-quickbtns';

  function findHeaderTitleEl() {
    // The "Print Checks" trowser header title
    return Array.from(document.querySelectorAll('h2')).find(
      (el) => el.textContent.trim() === 'Print Checks'
    );
  }

  function findAccountInput() {
    // The Account field is a labeled combobox; find the label then its input.
    const label = Array.from(document.querySelectorAll('label, span, div')).find(
      (el) => el.textContent.trim() === 'Account' && el.children.length === 0
    );
    if (!label) return null;
    const wrapper = label.closest('label')?.parentElement || label.parentElement;
    return wrapper ? wrapper.querySelector('input[role="combobox"]') : null;
  }

  function openDropdown(input) {
    if (input.getAttribute('aria-expanded') !== 'true') {
      input.click();
    }
  }

  function selectAccount(matchText) {
    const input = findAccountInput();
    if (!input) {
      console.warn('[QBO Account Buttons] Could not find Account input.');
      return;
    }

    openDropdown(input);

    // Give the listbox a brief moment to render, then click the matching option.
    setTimeout(() => {
      const listbox = document.querySelector('[role="listbox"]');
      if (!listbox) {
        console.warn('[QBO Account Buttons] Listbox did not open.');
        return;
      }
      const options = Array.from(listbox.querySelectorAll('[role="option"]'));
      const target = options.find((o) => o.textContent.includes(matchText));
      if (!target) {
        console.warn('[QBO Account Buttons] No option matched:', matchText);
        return;
      }
      target.click();
    }, 60);
  }

  function makeButton(acc) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `tm-acct-btn-${acc.key}`;
    btn.textContent = acc.label;
    btn.style.cssText = [
      'margin-left:6px',
      'padding:4px 10px',
      'font-size:12px',
      'font-weight:600',
      'border:1px solid #2CA01C',
      'border-radius:4px',
      'background:#fff',
      'color:#2CA01C',
      'cursor:pointer',
      'line-height:1.4',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#2CA01C';
      btn.style.color = '#fff';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#fff';
      btn.style.color = '#2CA01C';
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectAccount(acc.match);
    });
    return btn;
  }

  function injectButtons() {
    // Only act on the Print Checks screen; the script now loads on every QBO
    // page so it survives in-app (SPA) navigation without a refresh.
    if (!location.pathname.startsWith('/app/printchecks')) return;
    if (document.getElementById(BTN_BAR_ID)) return; // already injected

    const titleEl = findHeaderTitleEl();
    if (!titleEl) return;

    const bar = document.createElement('span');
    bar.id = BTN_BAR_ID;
    bar.style.cssText = 'display:inline-flex;align-items:center;margin-left:14px;';

    ACCOUNTS.forEach((acc) => bar.appendChild(makeButton(acc)));

    // Place the button bar right after the title, inside headerLeft, so it sits
    // in the same row as "Print Checks" on the upper bar.
    titleEl.parentElement.appendChild(bar);
  }

  // The Print Checks trowser can open/close without a full page reload, and QBO's
  // Angular app re-renders this header when it does. Use a MutationObserver to
  // (re)inject the button bar whenever the header shows up, and clean up our
  // bar id check above prevents duplicate injection.
  const observer = new MutationObserver(() => {
    injectButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial attempt in case the header is already present.
  injectButtons();
})();
