// ==UserScript==
// @name         Sakugabooru Frame Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a/d frame hotkeys and Space play/pause on Sakugabooru videos
// @author       achrllrogia45
// @match        https://*.sakugabooru.com/post/show/*
// @grant        none
// @updateURL    https://github.com/achrllrogia45/monkeyscripts/raw/main/sakugabooru-fbf.user.js
// @downloadURL  https://github.com/achrllrogia45/monkeyscripts/raw/main/sakugabooru-fbf.user.js
// ==/UserScript==

(function() {
    'use strict';

    // === CONFIGURATION ===
    // Easily change the keys, button text, or selectors here!
    const SHORTCUTS = {
        // Pressing 'd' clicks the button with text '1f >'
        'd': { type: 'text', target: '1f >' },
        // Pressing 'a' clicks the button with text '< 1f'
        'a': { type: 'text', target: '< 1f' },
        // Pressing Space clicks the Video.js play/pause button
        'Space': { type: 'selector', target: 'button.vjs-play-control' }
    };

    function isTypingInField() {
        const active = document.activeElement;
        return active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable
        );
    }

    function findShortcutButton(shortcut) {
        if (shortcut.type === 'selector') {
            return document.querySelector(shortcut.target);
        }

        if (shortcut.type === 'text') {
            return Array.from(document.querySelectorAll('button, a'))
                .find(el => el.textContent.trim() === shortcut.target);
        }

        return null;
    }

    window.addEventListener('keydown', function(e) {
        // Ignore shortcuts if typing in input fields
        if (isTypingInField()) return;

        // Use e.code for special keys like Space, and e.key for normal letters.
        const shortcut = SHORTCUTS[e.code] || SHORTCUTS[e.key.toLowerCase()];

        if (!shortcut) return;

        // Stop the page/site from treating Space as a focused click/next-video shortcut.
        e.preventDefault();
        e.stopPropagation();

        const btn = findShortcutButton(shortcut);
        if (btn) btn.click();
    }, true);
})();
