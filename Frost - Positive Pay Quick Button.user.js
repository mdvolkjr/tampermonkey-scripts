// ==UserScript==
// @name         Frost - Positive Pay Quick Button
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a "Positive Pay" button to the Frost Business Connect top bar that jumps straight to the Issue Voids multiple-entry page
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
                top: 8px;
                right: 380px;
                z-index: 99999;
                box-shadow: 0 1px 4px rgba(0,0,0,0.35);
            `;
        }
        btn.addEventListener('mouseenter', () => { btn.style.background = '#7bcdf0'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = '#4db8e8'; });
        btn.addEventListener('click', () => { window.location.assign(TARGET_URL); });
        return btn;
    }

    function isDark(el) {
        const bg = getComputedStyle(el).backgroundColor;
        const m = bg && bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return false;
        if (m[4] !== undefined && parseFloat(m[4]) === 0) return false; // transparent
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        return (0.299 * r + 0.587 * g + 0.114 * b) < 80; // perceived luminance
    }

    // Find the black title bar (the one showing "Home" / current page name) by
    // locating a heading near the top of the page whose ancestor has a dark
    // background. Class names are generated, so we go by looks, not selectors.
    function findDarkTitleBar() {
        const headings = document.querySelectorAll('h1, h2, h3, [class*="title" i], [class*="header" i] span');
        for (const h of headings) {
            const rect = h.getBoundingClientRect();
            if (rect.top < 0 || rect.top > 400 || rect.height === 0) continue;
            let node = h;
            for (let depth = 0; node && depth < 6; depth++) {
                if (isDark(node)) {
                    const r = node.getBoundingClientRect();
                    // Wide, shortish, horizontal bar
                    if (r.width > window.innerWidth * 0.5 && r.height < 120) return node;
                }
                node = node.parentElement;
            }
        }
        return null;
    }

    function inject() {
        const existing = document.getElementById(BUTTON_ID);
        if (existing && document.body.contains(existing)) return true;
        if (existing) existing.remove();

        // Preferred: inline on the dark Home bar, before the right-side controls
        const bar = findDarkTitleBar();
        if (bar) {
            const btn = makeButton(true);
            btn.style.alignSelf = 'center';
            const style = getComputedStyle(bar);
            if (style.display.includes('flex')) {
                btn.style.marginLeft = 'auto';
                // Keep the "Add Widget" dropdown (if present) as the right-most item
                const lastChild = bar.lastElementChild;
                if (lastChild) bar.insertBefore(btn, lastChild);
                else bar.appendChild(btn);
            } else {
                btn.style.cssText += 'position: absolute; right: 200px; top: 50%; transform: translateY(-50%);';
                if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
                bar.appendChild(btn);
            }
            return true;
        }

        // Fallback: fixed button at the top of the viewport
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
