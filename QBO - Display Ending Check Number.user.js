// ==UserScript==
// @name         QBO - Display Ending Check Number
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Shows the ending check number inline next to the Starting check number field on the Print Checks page
// @author       Michael Volk
// @match        https://qbo.intuit.com/*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/QBO%20-%20Display%20Ending%20Check%20Number.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/QBO%20-%20Display%20Ending%20Check%20Number.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DISPLAY_ID = 'qbo-ending-check-display';

    // Find the starting check number input by its label text — NOT by generated ID
    function getStartingCheckInput() {
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
            if (/starting check number/i.test(label.textContent)) {
                const inp = label.querySelector('input');
                if (inp) return inp;
            }
        }
        return null;
    }

    function getStartingCheckNumber() {
        const inp = getStartingCheckInput();
        if (inp && /^\d+$/.test(inp.value.trim())) return parseInt(inp.value.trim(), 10);
        return null;
    }

    function getCheckCount() {
        const bar = document.querySelector('[data-testid="batch-action-bar"]');
        if (bar) {
            const match = bar.textContent.match(/(\d+)\s+chequ?e/i);
            if (match) return parseInt(match[1], 10);
        }
        return null;
    }

    function injectDisplay() {
        // Only act on the Print Checks screen; the script now loads on every
        // QBO page so it survives in-app (SPA) navigation without a refresh.
        if (!location.pathname.startsWith('/app/printchecks')) return false;
        const inp = getStartingCheckInput();
        if (!inp) return false;

        const existing = document.getElementById(DISPLAY_ID);
        if (existing && document.body.contains(existing)) return true;
        if (existing) existing.remove();

        const wrapper = inp.closest('div[data-theme]');
        if (!wrapper) return false;

        const parent = wrapper.parentElement;
        if (parent) {
            parent.style.display = 'inline-flex';
            parent.style.alignItems = 'flex-end';
            parent.style.gap = '12px';
        }

        const el = document.createElement('div');
        el.id = DISPLAY_ID;
        el.style.cssText = `
            display: inline-flex;
            align-items: center;
            padding: 0 12px;
            height: 36px;
            background: #e7f5e7;
            border: 1.5px solid #2ca01c;
            border-radius: 6px;
            font-family: sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: #1a6b12;
            white-space: nowrap;
        `;

        wrapper.insertAdjacentElement('afterend', el);
        return true;
    }

    function update() {
        if (!injectDisplay()) return;

        const el = document.getElementById(DISPLAY_ID);
        if (!el) return;

        const start = getStartingCheckNumber();
        const count = getCheckCount();

        if (start !== null && count !== null && count > 0) {
            const ending = start + count - 1;
            el.textContent = `Ending check: ${ending}`;
            el.style.display = 'inline-flex';
        } else {
            el.style.display = 'none';
        }
    }

    // React to typing in the starting check number field
    document.body.addEventListener('input', (e) => {
        const inp = getStartingCheckInput();
        if (inp && e.target === inp) update();
    });

    // Debounced observer for DOM changes (account switches, check list updates)
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(update, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Persistent poller: cheap check every 400ms — re-injects if React ever removes the badge
    setInterval(() => {
        if (injectDisplay()) update();
    }, 400);
})();
