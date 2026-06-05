// ==UserScript==
// @name         Sakugabooru Frame Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds , and . hotkeys to Sakugabooru frame buttons
// @author       You
// @match        https://*.sakugabooru.com/post/show/*
// @grant        none
// @updateURL    https://github.com/achrllrogia45/monkeyscripts/raw/main/sakugabooru-fbf.user.js
// @downloadURL  https://github.com/achrllrogia45/monkeyscripts/raw/main/sakugabooru-fbf.user.js
// ==/UserScript==

(function() {
    'use strict';
    window.addEventListener('keydown', function(e) {
        // Ignore shortcuts if you are typing in the search bar or tags section
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        if (e.key === '.') {
            let btn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.trim() === '1f >');
            if (btn) btn.click();
        }
        if (e.key === ',') {
            let btn = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.trim() === '< 1f');
            if (btn) btn.click();
        }
    });
})();