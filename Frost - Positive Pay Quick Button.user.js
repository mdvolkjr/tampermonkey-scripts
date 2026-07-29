// ==UserScript==
// @name         Frost - Positive Pay Quick Button
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds a "Positive Pay" button next to the Frost Business Connect logo that jumps straight to the Issue Voids multiple-entry page
// @author       Michael Volk
// @match        https://frosttreasuryconnect.com/*
// @match        https://www.frosttreasuryconnect.com/*
// @updateURL    https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/Frost%20-%20Positive%20Pay%20Quick%20Button.user.js
// @downloadURL  https://raw.githubusercontent.com/mdvolkjr/tampermonkey-scripts/main/Frost%20-%20Positive%20Pay%20Quick%20Button.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'frost-positive-pay-btn';
    const TARGET_URL = 'https://frosttreasuryconnect.com/ui/RISK/issueVoids/multipleEntry';

    function makeButton(inline) {
        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.textContent = 'Positive Pay';
        btn.title = 'Go to Positive Pay (Issue Voids - Multiple Entry)';
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            padding: 6px 16px;
            margin: 0 12px;
            background: #4db8e8;
            color: #04202e;
            border: none;
            border-radius: 4px;
            font-family: inherit;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.3px;
            cursor: pointer;
            white-space: nowrap;
            line-height: 1.4;
        `;
        if (!inline) {
            // Fallback placement: pinned at the top of the page, clear of the bell/name area
            btn.style.cssText += `
                position: fixed;
                top: 60px;
                right: 420px;
                z-index: 99999;
                box-shadow: 0 1px 4px rgba(0,0,0,0.35);
            `;
        }
        btn.addEventListener('mouseenter', () => { btn.style.background = '#7bcdf0'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = '#4db8e8'; });
        btn.addEventListener('click', () => { window.location.assign(TARGET_URL); });
        return btn;
    }

    function inject() {
        const existing = document.getElementById(BUTTON_ID);
        if (existing && document.body.contains(existing)) return true;
        if (existing) existing.remove();

        // Preferred: anchored just right of the "Frost BUSINESS CONNECT" logo.
        // The logo's wrappers span the full header width, so flow layout pushes
        // the button to the far right — instead, position it absolutely inside
        // the logo container, offset by the logo's measured width.
        const container = document.querySelector('.powerbar [data-qa="logo-container"], .powerbar .logo-container');
        const logo = container && container.querySelector('a.logo');
        if (container && logo) {
            if (getComputedStyle(container).position === 'static') {
                container.style.position = 'relative';
            }
            const logoWidth = logo.getBoundingClientRect().width || 340;
            const btn = makeButton(true);
            btn.style.cssText += `
                position: absolute;
                left: ${Math.round(logoWidth + 40)}px;
                top: 50%;
                transform: translateY(-50%);
            `;
            container.appendChild(btn);
            return true;
        }

        // Fallback: fixed button at logo-row height so it never disappears
        if (document.body) {
            document.body.appendChild(makeButton(false));
            return true;
        }
        return false;
    }

    // Debounced observer for SPA navigation / re-renders
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(inject, 200);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Persistent poller: re-injects if the app ever removes the button
    setInterval(inject, 500);

    inject();
})();
