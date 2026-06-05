// ==UserScript==
// @name         Sakugabooru Frame Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds , and . hotkeys to Sakugabooru frame buttons
// @author       achrllrogia45
// @match        https://*.sakugabooru.com/post/show/*
// @grant        none
// @updateURL    https://github.com/achrllrogia45/monkeyscripts/raw/main/sakugabooru-fbf.user.js
// @downloadURL  https://github.com/achrllrogia45/monkeyscripts/raw/main/sakugabooru-fbf.user.js
// ==/UserScript==

(function() {
    'use strict';

    // === CONFIGURATION ===
    // Easily change the keys or button labels here!
    const SHORTCUTS = {
        // Pressing '.' clicks the button with text '1f >'
        '.': '1f >',
        // Pressing ',' clicks the button with text '< 1f'
        ',': '< 1f'
    };

    window.addEventListener('keydown', function(e) {
        // Ignore shortcuts if typing in input fields
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        // Check if the pressed key exists in our configuration
        const targetButtonText = SHORTCUTS[e.key];

        if (targetButtonText) {
            // Find and click the button that matches the text
            let btn = Array.from(document.querySelectorAll('button, a'))
                .find(el => el.textContent.trim() === targetButtonText);

            if (btn) btn.click();
        }
    });
})();
