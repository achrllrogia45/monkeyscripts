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
        'Space': { type: 'selector', target: 'button.vjs-play-control' },
        // Pressing 'f' clicks the Video.js fullscreen button
        'f': { type: 'selector', target: 'button.vjs-fullscreen-control' },
        // Pressing 'm' clicks the Video.js mute button
        'm': { type: 'selector', target: 'button.vjs-mute-control' },
        // Pressing 'p' toggles the Video.js playback-rate menu
        'p': { type: 'playback-menu' }
    };

    const PLAYBACK_MENU_KEYS = {
        // While playback menu is open, these keys move to the slower option
        down: ['ArrowDown', 's'],
        // While playback menu is open, these keys move to the faster option
        up: ['ArrowUp', 'w']
    };

    const CATPPUCCIN = {
        base: '#1e1e2e',
        mantle: '#181825',
        surface0: '#313244',
        surface1: '#45475a',
        text: '#cdd6f4',
        subtext: '#a6adc8',
        overlay: 'rgba(30, 30, 46, 0.82)',
        mauve: '#cba6f7',
        blue: '#89b4fa',
        border: 'rgba(203, 166, 247, 0.28)',
        shadow: 'none'
    };

    const FRAME_COUNTER = {
        enabled: true,
        // Options: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
        position: 'top-left',
        useMp4FrameCount: true,
        offsetX: '8px',
        offsetY: '8px',
        draggable: true,
        snapGrid: 10,
        storageKey: 'sakugabooru-frame-counter-position',
        zIndex: '9999',
        padding: '3px 6px',
        border: `1px solid ${CATPPUCCIN.border}`,
        borderRadius: '6px',
        background: CATPPUCCIN.overlay,
        color: CATPPUCCIN.text,
        fontSize: '11px',
        fontFamily: 'monospace',
        boxShadow: CATPPUCCIN.shadow
    };

    const SHORTCUT_BADGES = {
        enabled: true,
        storageKey: 'sakugabooru-shortcut-badges-enabled',
        labels: {
            a: 'A',
            d: 'D',
            Space: 'Space',
            f: 'F',
            m: 'M',
            p: 'P'
        },
        top: '-3px',
        right: '-3px',
        zIndex: '10000',
        padding: '1px 4px',
        border: `1px solid ${CATPPUCCIN.border}`,
        borderRadius: '5px',
        background: CATPPUCCIN.overlay,
        color: CATPPUCCIN.mauve,
        fontSize: '9px',
        fontFamily: 'monospace',
        fontWeight: '600',
        lineHeight: '1.1',
        boxShadow: 'none'
    };

    const SETTINGS_BUTTON = {
        enabled: true,
        storageKey: 'sakugabooru-shortcut-settings',
        offsetX: '5px',
        offsetY: '45px',
        draggable: true,
        snapGrid: 10,
        positionStorageKey: 'sakugabooru-settings-button-position',
        zIndex: '10001',
        icon: '⚙',
        size: '20px',
        background: CATPPUCCIN.overlay,
        color: CATPPUCCIN.mauve,
        border: `1px solid ${CATPPUCCIN.border}`,
        shadow: CATPPUCCIN.shadow,
        panelBackground: 'rgba(24, 24, 37, 0.94)',
        panelColor: CATPPUCCIN.text,
        panelPadding: '8px',
        panelBorder: `1px solid ${CATPPUCCIN.border}`,
        panelBorderRadius: '7px',
        panelFontSize: '11px',
        panelFontFamily: 'monospace',
        panelShadow: CATPPUCCIN.shadow,
        panelWidth: '176px'
    };

    const FRAME_SCRUBBING = {
        enabled: true,
        holdDelayMs: 180,
        intervalMs: 42,
        slowIntervalMs: 120,
        jumpSmallFrames: 10,
        jumpLargeFrames: 50,
        jumpIntervalMs: 120,
        largeJumpIntervalMs: 180,
        waitForSeek: true
    };

    const VIDEO_PRELOAD = {
        enabled: false
    };

    const DEFAULT_SETTINGS = {
        frameCounter: FRAME_COUNTER.enabled,
        shortcutBadges: SHORTCUT_BADGES.enabled,
        videoPreload: VIDEO_PRELOAD.enabled
    };

    let uiSettings = loadSettings();
    const mp4FrameCounts = new Map();

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_BUTTON.storageKey) || '{}');
            return Object.assign({}, DEFAULT_SETTINGS, saved);
        } catch (error) {
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_BUTTON.storageKey, JSON.stringify(uiSettings));
        } catch (error) {}
    }

    function getPlayer() {
        return document.querySelector('.video-js') || getVideo() && getVideo().parentElement;
    }

    function readString(view, offset, length) {
        let value = '';
        for (let i = 0; i < length; i++) {
            value += String.fromCharCode(view.getUint8(offset + i));
        }
        return value;
    }

    function readUint64(view, offset) {
        const high = view.getUint32(offset);
        const low = view.getUint32(offset + 4);
        return high * 4294967296 + low;
    }

    function readBoxHeader(view, offset, end) {
        if (offset + 8 > end) return null;

        let size = view.getUint32(offset);
        const type = readString(view, offset + 4, 4);
        let headerSize = 8;

        if (size === 1) {
            if (offset + 16 > end) return null;
            size = readUint64(view, offset + 8);
            headerSize = 16;
        } else if (size === 0) {
            size = end - offset;
        }

        if (size < headerSize || offset + size > end) return null;

        return {
            type: type,
            start: offset,
            headerEnd: offset + headerSize,
            end: offset + size
        };
    }

    function findBoxes(view, start, end, type) {
        const boxes = [];
        let offset = start;

        while (offset + 8 <= end) {
            const box = readBoxHeader(view, offset, end);
            if (!box) break;
            if (box.type === type) boxes.push(box);
            offset = box.end;
        }

        return boxes;
    }

    function findBox(view, start, end, type) {
        return findBoxes(view, start, end, type)[0] || null;
    }

    function getTrackHandlerType(view, mdiaBox) {
        const hdlr = findBox(view, mdiaBox.headerEnd, mdiaBox.end, 'hdlr');
        if (!hdlr || hdlr.headerEnd + 12 > hdlr.end) return null;
        return readString(view, hdlr.headerEnd + 8, 4);
    }

    function getSampleCountFromTrack(view, trakBox) {
        const mdia = findBox(view, trakBox.headerEnd, trakBox.end, 'mdia');
        if (!mdia || getTrackHandlerType(view, mdia) !== 'vide') return null;

        const minf = findBox(view, mdia.headerEnd, mdia.end, 'minf');
        const stbl = minf && findBox(view, minf.headerEnd, minf.end, 'stbl');
        if (!stbl) return null;

        const stsz = findBox(view, stbl.headerEnd, stbl.end, 'stsz');
        if (stsz && stsz.headerEnd + 12 <= stsz.end) {
            return view.getUint32(stsz.headerEnd + 8);
        }

        const stz2 = findBox(view, stbl.headerEnd, stbl.end, 'stz2');
        if (stz2 && stz2.headerEnd + 12 <= stz2.end) {
            return view.getUint32(stz2.headerEnd + 8);
        }

        return null;
    }

    function parseMp4FrameCount(buffer) {
        const view = new DataView(buffer);
        const moov = findBox(view, 0, view.byteLength, 'moov');
        if (!moov) return null;

        const tracks = findBoxes(view, moov.headerEnd, moov.end, 'trak');
        for (const track of tracks) {
            const sampleCount = getSampleCountFromTrack(view, track);
            if (sampleCount) return sampleCount;
        }

        return null;
    }

    async function fetchMp4FrameCount(url) {
        if (!url || mp4FrameCounts.has(url)) return mp4FrameCounts.get(url) || null;

        mp4FrameCounts.set(url, null);

        try {
            // Fetch ONLY the first 500KB. This skips downloading the actual video data (mdat) 
            // and just grabs the headers (moov) where the frame count lives.
            const response = await fetch(url, {
                headers: {
                    'Range': 'bytes=0-500000'
                }
            });
            
            // 206 Partial Content is the success code for Range requests
            if (!response.ok && response.status !== 206) return null;

            const buffer = await response.arrayBuffer();
            const frameCount = parseMp4FrameCount(buffer);
            mp4FrameCounts.set(url, frameCount || null);
            return frameCount || null;
        } catch (error) {
            mp4FrameCounts.set(url, null);
            return null;
        }
    }

    function getVideoSource(video) {
        return video.currentSrc || video.src || document.querySelector('source') && document.querySelector('source').src;
    }

    function requestMp4FrameCount(video) {
        if (!FRAME_COUNTER.useMp4FrameCount || !video) return;

        const url = getVideoSource(video);
        if (!url || mp4FrameCounts.has(url)) return;

        fetchMp4FrameCount(url).then(updateFrameCounter);
    }

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
                .find(el => {
                    const clone = el.cloneNode(true);
                    clone.querySelectorAll('.sakugabooru-shortcut-badge').forEach(badge => badge.remove());
                    return clone.textContent.trim() === shortcut.target;
                });
        }

        if (shortcut.type === 'playback-menu') {
            return document.querySelector('button.vjs-playback-rate');
        }

        return null;
    }

    function getShortcutLabel(key) {
        return SHORTCUT_BADGES.labels[key] || SHORTCUT_BADGES.labels[key.toLowerCase()] || key.toUpperCase();
    }

    function removeShortcutBadges() {
        document.querySelectorAll('.sakugabooru-shortcut-badge').forEach(badge => badge.remove());
    }

    function styleShortcutBadge(badge) {
        badge.style.position = 'absolute';
        badge.style.top = SHORTCUT_BADGES.top;
        badge.style.right = SHORTCUT_BADGES.right;
        badge.style.zIndex = SHORTCUT_BADGES.zIndex;
        badge.style.padding = SHORTCUT_BADGES.padding;
        badge.style.border = SHORTCUT_BADGES.border;
        badge.style.borderRadius = SHORTCUT_BADGES.borderRadius;
        badge.style.background = SHORTCUT_BADGES.background;
        badge.style.color = SHORTCUT_BADGES.color;
        badge.style.fontSize = SHORTCUT_BADGES.fontSize;
        badge.style.fontFamily = SHORTCUT_BADGES.fontFamily;
        badge.style.fontWeight = SHORTCUT_BADGES.fontWeight;
        badge.style.lineHeight = SHORTCUT_BADGES.lineHeight;
        badge.style.boxShadow = SHORTCUT_BADGES.boxShadow;
        badge.style.pointerEvents = 'none';
    }

    function createShortcutBadges() {
        if (!uiSettings.shortcutBadges) return;

        Object.keys(SHORTCUTS).forEach(key => {
            const btn = findShortcutButton(SHORTCUTS[key]);
            if (!btn) return;

            const badgeId = `sakugabooru-shortcut-badge-${key.replace(/[^a-z0-9]/gi, '-')}`;
            let badge = btn.querySelector(`[data-shortcut-badge-id="${badgeId}"]`);

            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'sakugabooru-shortcut-badge';
                badge.dataset.shortcutBadgeId = badgeId;
                btn.appendChild(badge);
            }

            if (getComputedStyle(btn).position === 'static') {
                btn.style.position = 'relative';
            }

            badge.textContent = getShortcutLabel(key);
            styleShortcutBadge(badge);
        });
    }

    function updateShortcutBadges() {
        if (uiSettings.shortcutBadges) {
            createShortcutBadges();
        } else {
            removeShortcutBadges();
        }
    }

    function getPlaybackMenu() {
        return document.querySelector('.vjs-playback-rate');
    }

    function getPlaybackButton() {
        return document.querySelector('button.vjs-playback-rate');
    }

    function isPlaybackMenuOpen() {
        const button = getPlaybackButton();
        const menu = getPlaybackMenu();

        return Boolean(
            button && button.getAttribute('aria-expanded') === 'true' ||
            menu && menu.querySelector('.vjs-menu.vjs-lock-showing')
        );
    }

    function togglePlaybackMenu() {
        const button = getPlaybackButton();
        if (button) button.click();
    }

    function keepPlaybackMenuOpen() {
        const button = getPlaybackButton();
        const menu = getPlaybackMenu();
        const menuPanel = menu && menu.querySelector('.vjs-menu');

        if (button) button.setAttribute('aria-expanded', 'true');
        if (menuPanel) menuPanel.classList.add('vjs-lock-showing');
    }

    function cyclePlaybackRate(direction) {
        const menu = getPlaybackMenu();
        if (!menu) return;

        const items = Array.from(menu.querySelectorAll('.vjs-menu-item'));
        if (!items.length) return;

        const selectedIndex = items.findIndex(item => item.classList.contains('vjs-selected'));
        const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
        const nextIndex = (currentIndex + direction + items.length) % items.length;

        items[nextIndex].click();
        keepPlaybackMenuOpen();
    }

    function isPlaybackMenuKey(e, direction) {
        return PLAYBACK_MENU_KEYS[direction].includes(e.code) ||
            PLAYBACK_MENU_KEYS[direction].includes(e.key.toLowerCase());
    }

    function getVideo() {
        return document.querySelector('video.vjs-tech, video');
    }

    function getVideoFps() {
        const video = getVideo();
        if (!video) return null;

        const setupText = video.getAttribute('data-setup');
        if (!setupText) return null;

        try {
            const setup = JSON.parse(setupText);
            return setup.plugins &&
                setup.plugins.framebyframe &&
                setup.plugins.framebyframe.fps;
        } catch (error) {
            return null;
        }
    }

    let frameCounterVideo = null;
    let frameCounterStartOffset = 0;

    function getFrameCounterTime(video, fps) {
        if (frameCounterVideo !== video) {
            frameCounterVideo = video;
            frameCounterStartOffset = video.currentTime < 3 / fps ? video.currentTime : 0;
        }

        return Math.max(0, video.currentTime - frameCounterStartOffset);
    }

    function getFrameCounterText() {
        const video = getVideo();
        const fps = getVideoFps();

        if (!video || !fps || !video.duration) return 'Frame: -- / --';

        requestMp4FrameCount(video);

        const displayTime = getFrameCounterTime(video, fps);
        let currentFrame = Math.round(displayTime * fps) + 1;
        const videoSource = getVideoSource(video);
        const mp4FrameCount = videoSource && mp4FrameCounts.get(videoSource);
        const totalFrames = mp4FrameCount || Math.round(video.duration * fps);

        if (currentFrame < 1) currentFrame = 1;
        if (currentFrame > totalFrames) currentFrame = totalFrames;

        return `Frame: ${currentFrame} / ${totalFrames} · ${fps}fps`;
    }

    function clearFrameCounterPosition(counter) {
        counter.style.top = '';
        counter.style.right = '';
        counter.style.bottom = '';
        counter.style.left = '';
    }

    function applyDefaultFrameCounterPosition(counter) {
        const vertical = FRAME_COUNTER.position.startsWith('bottom') ? 'bottom' : 'top';
        const horizontal = FRAME_COUNTER.position.endsWith('right') ? 'right' : 'left';

        clearFrameCounterPosition(counter);
        counter.style[vertical] = FRAME_COUNTER.offsetY;
        counter.style[horizontal] = FRAME_COUNTER.offsetX;
    }

    function loadFrameCounterPosition() {
        try {
            const saved = localStorage.getItem(FRAME_COUNTER.storageKey);
            return saved && JSON.parse(saved);
        } catch (error) {
            return null;
        }
    }

    function saveFrameCounterPosition(left, top) {
        try {
            localStorage.setItem(FRAME_COUNTER.storageKey, JSON.stringify({
                left: left,
                top: top
            }));
        } catch (error) {}
    }

    function applySavedFrameCounterPosition(counter, position) {
        clearFrameCounterPosition(counter);
        counter.style.left = `${position.left}px`;
        counter.style.top = `${position.top}px`;
    }

    function resetFrameCounterPosition(counter) {
        try {
            localStorage.removeItem(FRAME_COUNTER.storageKey);
        } catch (error) {}

        applyDefaultFrameCounterPosition(counter);
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getCounterPositionInPlayer(counter, player) {
        const counterRect = counter.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();

        return {
            left: counterRect.left - playerRect.left,
            top: counterRect.top - playerRect.top
        };
    }

    function moveFrameCounter(counter, player, left, top, shouldSnap) {
        const maxLeft = Math.max(0, player.clientWidth - counter.offsetWidth);
        const maxTop = Math.max(0, player.clientHeight - counter.offsetHeight);
        let nextLeft = clamp(left, 0, maxLeft);
        let nextTop = clamp(top, 0, maxTop);

        if (shouldSnap && FRAME_COUNTER.snapGrid > 0) {
            nextLeft = clamp(Math.round(nextLeft / FRAME_COUNTER.snapGrid) * FRAME_COUNTER.snapGrid, 0, maxLeft);
            nextTop = clamp(Math.round(nextTop / FRAME_COUNTER.snapGrid) * FRAME_COUNTER.snapGrid, 0, maxTop);
        }

        applySavedFrameCounterPosition(counter, {
            left: nextLeft,
            top: nextTop
        });

        return {
            left: nextLeft,
            top: nextTop
        };
    }

    function loadSettingsButtonPosition() {
        try {
            const saved = localStorage.getItem(SETTINGS_BUTTON.positionStorageKey);
            return saved && JSON.parse(saved);
        } catch (error) {
            return null;
        }
    }

    function saveSettingsButtonPosition(left, top) {
        try {
            localStorage.setItem(SETTINGS_BUTTON.positionStorageKey, JSON.stringify({
                left: left,
                top: top
            }));
        } catch (error) {}
    }

    function applyDefaultSettingsButtonPosition(wrapper) {
        wrapper.style.top = '';
        wrapper.style.left = '';
        wrapper.style.right = SETTINGS_BUTTON.offsetX;
        wrapper.style.bottom = SETTINGS_BUTTON.offsetY;
    }

    function applySavedSettingsButtonPosition(wrapper, position) {
        wrapper.style.right = '';
        wrapper.style.bottom = '';
        wrapper.style.left = `${position.left}px`;
        wrapper.style.top = `${position.top}px`;
    }

    function moveSettingsButton(wrapper, player, left, top, shouldSnap) {
        const maxLeft = Math.max(0, player.clientWidth - wrapper.offsetWidth);
        const maxTop = Math.max(0, player.clientHeight - wrapper.offsetHeight);
        let nextLeft = clamp(left, 0, maxLeft);
        let nextTop = clamp(top, 0, maxTop);

        if (shouldSnap && SETTINGS_BUTTON.snapGrid > 0) {
            nextLeft = clamp(Math.round(nextLeft / SETTINGS_BUTTON.snapGrid) * SETTINGS_BUTTON.snapGrid, 0, maxLeft);
            nextTop = clamp(Math.round(nextTop / SETTINGS_BUTTON.snapGrid) * SETTINGS_BUTTON.snapGrid, 0, maxTop);
        }

        applySavedSettingsButtonPosition(wrapper, {
            left: nextLeft,
            top: nextTop
        });

        return {
            left: nextLeft,
            top: nextTop
        };
    }

    function resetSettingsButtonPosition(wrapper) {
        try {
            localStorage.removeItem(SETTINGS_BUTTON.positionStorageKey);
        } catch (error) {}

        applyDefaultSettingsButtonPosition(wrapper);
    }

    function makeSettingsButtonDraggable(wrapper, button, player) {
        let dragStart = null;
        let moved = false;

        button.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const position = getCounterPositionInPlayer(wrapper, player);
            dragStart = {
                pointerX: e.clientX,
                pointerY: e.clientY,
                left: position.left,
                top: position.top
            };
            moved = false;
            button.setPointerCapture(e.pointerId);
        });

        button.addEventListener('pointermove', function(e) {
            if (!dragStart) return;

            e.preventDefault();
            e.stopPropagation();

            const dx = e.clientX - dragStart.pointerX;
            const dy = e.clientY - dragStart.pointerY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;

            moveSettingsButton(wrapper, player, dragStart.left + dx, dragStart.top + dy, e.shiftKey);
        });

        button.addEventListener('pointerup', function(e) {
            if (!dragStart) return;

            e.preventDefault();
            e.stopPropagation();

            const position = getCounterPositionInPlayer(wrapper, player);
            saveSettingsButtonPosition(position.left, position.top);
            dragStart = null;
            setTimeout(function() {
                moved = false;
            }, 0);
            button.releasePointerCapture(e.pointerId);
        });

        button.addEventListener('click', function(e) {
            if (!moved) return;
            e.preventDefault();
            e.stopPropagation();
        }, true);

        button.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            resetSettingsButtonPosition(wrapper);
        });
    }

    function makeFrameCounterDraggable(counter, player) {
        let dragStart = null;

        counter.addEventListener('pointerdown', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const position = getCounterPositionInPlayer(counter, player);
            dragStart = {
                pointerX: e.clientX,
                pointerY: e.clientY,
                left: position.left,
                top: position.top
            };

            counter.setPointerCapture(e.pointerId);
        });

        counter.addEventListener('pointermove', function(e) {
            if (!dragStart) return;

            e.preventDefault();
            e.stopPropagation();

            moveFrameCounter(
                counter,
                player,
                dragStart.left + e.clientX - dragStart.pointerX,
                dragStart.top + e.clientY - dragStart.pointerY,
                e.shiftKey
            );
        });

        counter.addEventListener('pointerup', function(e) {
            if (!dragStart) return;

            e.preventDefault();
            e.stopPropagation();

            const position = getCounterPositionInPlayer(counter, player);
            saveFrameCounterPosition(position.left, position.top);
            dragStart = null;
            counter.releasePointerCapture(e.pointerId);
        });

        counter.addEventListener('dblclick', function(e) {
            e.preventDefault();
            e.stopPropagation();
            resetFrameCounterPosition(counter);
        });
    }

    function createFrameCounter() {
        if (!uiSettings.frameCounter || document.querySelector('#sakugabooru-frame-counter')) return;

        const player = getPlayer();
        if (!player) return;

        const counter = document.createElement('div');
        counter.id = 'sakugabooru-frame-counter';
        counter.textContent = getFrameCounterText();
        counter.style.position = 'absolute';
        applyDefaultFrameCounterPosition(counter);
        counter.style.zIndex = FRAME_COUNTER.zIndex;
        counter.style.padding = FRAME_COUNTER.padding;
        counter.style.border = FRAME_COUNTER.border;
        counter.style.borderRadius = FRAME_COUNTER.borderRadius;
        counter.style.background = FRAME_COUNTER.background;
        counter.style.color = FRAME_COUNTER.color;
        counter.style.fontSize = FRAME_COUNTER.fontSize;
        counter.style.fontFamily = FRAME_COUNTER.fontFamily;
        counter.style.boxShadow = FRAME_COUNTER.boxShadow;
        counter.style.pointerEvents = FRAME_COUNTER.draggable ? 'auto' : 'none';
        counter.style.cursor = FRAME_COUNTER.draggable ? 'move' : 'default';
        counter.style.userSelect = 'none';

        if (getComputedStyle(player).position === 'static') {
            player.style.position = 'relative';
        }

        player.appendChild(counter);

        const savedPosition = loadFrameCounterPosition();
        if (savedPosition && Number.isFinite(savedPosition.left) && Number.isFinite(savedPosition.top)) {
            moveFrameCounter(counter, player, savedPosition.left, savedPosition.top, false);
        }

        if (FRAME_COUNTER.draggable) {
            makeFrameCounterDraggable(counter, player);
        }
    }

    function updateFrameCounter() {
        const counter = document.querySelector('#sakugabooru-frame-counter');
        if (!uiSettings.frameCounter) {
            if (counter) counter.remove();
            return;
        }

        createFrameCounter();
        if (counter) counter.textContent = getFrameCounterText();
    }

    function createSettingsUi() {
        if (!SETTINGS_BUTTON.enabled || document.querySelector('#sakugabooru-shortcut-settings')) return;

        const player = getPlayer();
        if (!player) return;

        if (getComputedStyle(player).position === 'static') {
            player.style.position = 'relative';
        }

        const wrapper = document.createElement('div');
        wrapper.id = 'sakugabooru-shortcut-settings';
        wrapper.style.position = 'absolute';
        applyDefaultSettingsButtonPosition(wrapper);
        wrapper.style.zIndex = SETTINGS_BUTTON.zIndex;
        wrapper.style.fontFamily = SETTINGS_BUTTON.panelFontFamily;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = SETTINGS_BUTTON.icon;
        button.style.width = SETTINGS_BUTTON.size;
        button.style.height = SETTINGS_BUTTON.size;
        button.style.padding = '0';
        button.style.border = SETTINGS_BUTTON.border;
        button.style.borderRadius = '6px';
        button.style.background = SETTINGS_BUTTON.background;
        button.style.color = SETTINGS_BUTTON.color;
        button.style.boxShadow = SETTINGS_BUTTON.shadow;
        button.style.cursor = SETTINGS_BUTTON.draggable ? 'move' : 'pointer';
        button.style.fontSize = '13px';
        button.style.lineHeight = SETTINGS_BUTTON.size;

        const panel = document.createElement('div');
        panel.style.display = 'none';
        panel.style.position = 'absolute';
        panel.style.right = '0';
        panel.style.bottom = `calc(${SETTINGS_BUTTON.size} + 6px)`;
        panel.style.width = SETTINGS_BUTTON.panelWidth;
        panel.style.boxSizing = 'border-box';
        panel.style.padding = SETTINGS_BUTTON.panelPadding;
        panel.style.border = SETTINGS_BUTTON.panelBorder;
        panel.style.borderRadius = SETTINGS_BUTTON.panelBorderRadius;
        panel.style.background = SETTINGS_BUTTON.panelBackground;
        panel.style.color = SETTINGS_BUTTON.panelColor;
        panel.style.fontSize = SETTINGS_BUTTON.panelFontSize;
        panel.style.lineHeight = '1.35';
        panel.style.boxShadow = SETTINGS_BUTTON.panelShadow;
        panel.style.backdropFilter = 'blur(4px)';

        const panelHeader = document.createElement('div');
        panelHeader.style.display = 'flex';
        panelHeader.style.justifyContent = 'space-between';
        panelHeader.style.alignItems = 'center';
        panelHeader.style.gap = '8px';
        panelHeader.style.marginBottom = '8px';
        panelHeader.style.paddingBottom = '7px';
        panelHeader.style.borderBottom = `1px solid ${CATPPUCCIN.border}`;

        const titleWrap = document.createElement('div');
        titleWrap.style.display = 'flex';
        titleWrap.style.flexDirection = 'column';
        titleWrap.style.gap = '1px';

        const panelTitle = document.createElement('span');
        panelTitle.textContent = 'Shortcuts';
        panelTitle.style.color = CATPPUCCIN.text;
        panelTitle.style.fontWeight = '600';
        panelTitle.style.letterSpacing = '0.01em';

        const panelSubtitle = document.createElement('span');
        panelSubtitle.textContent = 'Frame controls';
        panelSubtitle.style.color = CATPPUCCIN.subtext;
        panelSubtitle.style.fontSize = '10px';

        const helpButton = document.createElement('button');
        helpButton.type = 'button';
        helpButton.textContent = '?';
        helpButton.style.width = '22px';
        helpButton.style.height = '22px';
        helpButton.style.flex = '0 0 22px';
        helpButton.style.padding = '0';
        helpButton.style.border = `1px solid ${CATPPUCCIN.border}`;
        helpButton.style.borderRadius = '5px';
        helpButton.style.background = CATPPUCCIN.surface0;
        helpButton.style.color = CATPPUCCIN.mauve;
        helpButton.style.cursor = 'help';
        helpButton.style.fontWeight = '600';
        helpButton.style.boxShadow = 'none';

        const helpPanel = document.createElement('div');
        helpPanel.style.display = 'none';
        helpPanel.style.margin = '0 0 6px';
        helpPanel.style.padding = '6px';
        helpPanel.style.border = `1px solid ${CATPPUCCIN.border}`;
        helpPanel.style.borderRadius = '6px';
        helpPanel.style.background = CATPPUCCIN.base;
        helpPanel.style.color = CATPPUCCIN.subtext;
        helpPanel.style.fontSize = '10px';
        helpPanel.style.lineHeight = '1.5';
        helpPanel.style.whiteSpace = 'pre-line';
        helpPanel.style.boxShadow = 'none';

        function bold(text) {
            const span = document.createElement('span');
            span.textContent = text;
            span.style.color = CATPPUCCIN.text;
            span.style.fontWeight = '600';
            return span;
        }

        function line(...parts) {
            const div = document.createElement('div');
            parts.forEach(part => {
                if (typeof part === 'string') {
                    div.appendChild(document.createTextNode(part));
                } else {
                    div.appendChild(part);
                }
            });
            return div;
        }

        function getShortcutKeys(target) {
            return Object.keys(SHORTCUTS).filter(k => {
                const s = SHORTCUTS[k];
                return (s.type === 'selector' && s.target === target) ||
                       (s.type === 'text' && s.target === target);
            });
        }

        function getPlaybackMenuKeys() {
            return Object.keys(SHORTCUTS).filter(k => SHORTCUTS[k].type === 'playback-menu');
        }

        const frameBackKeys = getShortcutKeys('< 1f');
        const frameForwardKeys = getShortcutKeys('1f >');
        const playKeys = getShortcutKeys('button.vjs-play-control');
        const fullscreenKeys = getShortcutKeys('button.vjs-fullscreen-control');
        const muteKeys = getShortcutKeys('button.vjs-mute-control');
        const playbackKeys = getPlaybackMenuKeys();

        const frameKeys = [...frameBackKeys, ...frameForwardKeys].map(k => k === 'Space' ? 'Space' : k.toUpperCase()).join('/');
        const playKey = playKeys.map(k => k === 'Space' ? 'Space' : k.toUpperCase()).join('/');
        const fullscreenKey = fullscreenKeys.map(k => k === 'Space' ? 'Space' : k.toUpperCase()).join('/');
        const muteKey = muteKeys.map(k => k === 'Space' ? 'Space' : k.toUpperCase()).join('/');
        const playbackKey = playbackKeys.map(k => k === 'Space' ? 'Space' : k.toUpperCase()).join('/');
        const menuUpKeys = PLAYBACK_MENU_KEYS.up.map(k => k === 'ArrowUp' ? '↑' : k === 'ArrowDown' ? '↓' : k.toUpperCase()).join('/');
        const menuDownKeys = PLAYBACK_MENU_KEYS.down.map(k => k === 'ArrowUp' ? '↑' : k === 'ArrowDown' ? '↓' : k.toUpperCase()).join('/');
        const menuKeys = [...new Set([...PLAYBACK_MENU_KEYS.up, ...PLAYBACK_MENU_KEYS.down])]
            .map(k => k === 'ArrowUp' ? '↑' : k === 'ArrowDown' ? '↓' : k.toUpperCase())
            .join('/');

        if (frameKeys) helpPanel.appendChild(line(bold(frameKeys), ': move frame'));
        if (frameKeys) helpPanel.appendChild(line(bold('Hold'), ': scrub frames'));
        if (frameKeys) helpPanel.appendChild(line(bold('Shift'), ': slow scrub'));
        if (frameKeys) helpPanel.appendChild(line(bold('Ctrl'), ': jump ', FRAME_SCRUBBING.jumpSmallFrames.toString(), ' frames'));
        if (frameKeys) helpPanel.appendChild(line(bold('Alt'), ': jump ', FRAME_SCRUBBING.jumpLargeFrames.toString(), ' frames'));
        if (playKey) helpPanel.appendChild(line(bold(playKey), ': play/pause'));
        if (fullscreenKey && muteKey) {
            helpPanel.appendChild(line(bold(`${fullscreenKey}/${muteKey}`), ': fullscreen/mute'));
        } else if (fullscreenKey) {
            helpPanel.appendChild(line(bold(fullscreenKey), ': fullscreen'));
        } else if (muteKey) {
            helpPanel.appendChild(line(bold(muteKey), ': mute'));
        }
        if (playbackKey) helpPanel.appendChild(line(bold(playbackKey), ': speed menu'));
        if (menuKeys) helpPanel.appendChild(line(bold(menuKeys), ': cycle speed'));
        if (FRAME_COUNTER.draggable || SETTINGS_BUTTON.draggable) {
            helpPanel.appendChild(line(bold('Shift-drag'), ': snap overlays'));
            helpPanel.appendChild(line(bold('Double-click'), ': reset overlays'));
        }

        helpButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            helpPanel.style.display = helpPanel.style.display === 'none' ? 'block' : 'none';
        });

        titleWrap.appendChild(panelTitle);
        titleWrap.appendChild(panelSubtitle);
        panelHeader.appendChild(titleWrap);
        panelHeader.appendChild(helpButton);
        panel.appendChild(panelHeader);
        panel.appendChild(helpPanel);

        function addCheckbox(labelText, settingKey, onChange) {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.justifyContent = 'space-between';
            label.style.gap = '8px';
            label.style.whiteSpace = 'nowrap';
            label.style.cursor = 'pointer';
            label.style.padding = '6px 7px';
            label.style.marginTop = '5px';
            label.style.border = `1px solid ${CATPPUCCIN.border}`;
            label.style.borderRadius = '6px';
            label.style.background = CATPPUCCIN.base;

            const labelName = document.createElement('span');
            labelName.textContent = labelText;
            labelName.style.color = CATPPUCCIN.text;

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Boolean(uiSettings[settingKey]);
            input.style.accentColor = CATPPUCCIN.mauve;
            input.style.margin = '0';
            input.addEventListener('change', function(e) {
                e.stopPropagation();
                uiSettings[settingKey] = input.checked;
                saveSettings();
                onChange();
            });

            label.appendChild(labelName);
            label.appendChild(input);
            panel.appendChild(label);
        }

        addCheckbox('Frame counter', 'frameCounter', function() {
            updateFrameCounter();
        });

        addCheckbox('Shortcut overlay', 'shortcutBadges', function() {
            updateShortcutBadges();
        });

        addCheckbox('Video preload', 'videoPreload', function() {
            updateVideoPreload();
        });

        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        wrapper.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        wrapper.appendChild(button);
        wrapper.appendChild(panel);
        player.appendChild(wrapper);

        const savedPosition = loadSettingsButtonPosition();
        if (savedPosition && Number.isFinite(savedPosition.left) && Number.isFinite(savedPosition.top)) {
            moveSettingsButton(wrapper, player, savedPosition.left, savedPosition.top, false);
        }

        if (SETTINGS_BUTTON.draggable) {
            makeSettingsButtonDraggable(wrapper, button, player);
        }
    }

    function updateVideoPreload() {
        const video = getVideo();
        if (!video) return;

        if (uiSettings.videoPreload) {
            if (video.preload !== 'auto') {
                video.preload = 'auto';
                if (video.paused && video.readyState < 3) {
                    video.load();
                }
            }
        } else if (video.preload === 'auto') {
            video.preload = 'metadata';
        }
    }

    function updateUi() {
        updateFrameCounter();
        updateShortcutBadges();
        createSettingsUi();
        updateVideoPreload();
    }

    function initUi() {
        updateUi();
        setInterval(updateUi, 100);
    }

    initUi();

    const frameScrub = {
        direction: 0,
        mode: null,
        holdDelayTimer: null,
        timer: null
    };

    function getFrameShortcutDirection(key) {
        const normalizedKey = key === 'Space' ? key : key.toLowerCase();
        const shortcut = SHORTCUTS[normalizedKey];
        if (!shortcut || shortcut.type !== 'text') return 0;
        if (shortcut.target === '1f >') return 1;
        if (shortcut.target === '< 1f') return -1;
        return 0;
    }

    function getFrameStepMode(e) {
        if (e.altKey) {
            return {
                frames: FRAME_SCRUBBING.jumpLargeFrames,
                intervalMs: FRAME_SCRUBBING.largeJumpIntervalMs,
                name: 'large'
            };
        }

        if (e.ctrlKey) {
            return {
                frames: FRAME_SCRUBBING.jumpSmallFrames,
                intervalMs: FRAME_SCRUBBING.jumpIntervalMs,
                name: 'small'
            };
        }

        if (e.shiftKey) {
            return {
                frames: 1,
                intervalMs: FRAME_SCRUBBING.slowIntervalMs,
                name: 'slow'
            };
        }

        return {
            frames: 1,
            intervalMs: FRAME_SCRUBBING.intervalMs,
            name: 'normal'
        };
    }

    function stepFrame(direction, frames) {
        const video = getVideo();
        if (FRAME_SCRUBBING.waitForSeek && video && video.seeking) return;

        const targetText = direction > 0 ? '1f >' : '< 1f';
        const btn = findShortcutButton({ type: 'text', target: targetText });
        if (!btn) return;

        for (let i = 0; i < frames; i++) {
            btn.click();
        }
    }

    function stopFrameScrub() {
        if (frameScrub.holdDelayTimer) {
            clearTimeout(frameScrub.holdDelayTimer);
            frameScrub.holdDelayTimer = null;
        }
        if (frameScrub.timer) {
            clearInterval(frameScrub.timer);
            frameScrub.timer = null;
        }
        frameScrub.direction = 0;
        frameScrub.mode = null;
    }

    function startFrameScrub(direction, mode) {
        if (!FRAME_SCRUBBING.enabled) {
            stepFrame(direction, mode.frames);
            return;
        }

        if (frameScrub.direction === direction && frameScrub.mode === mode.name && (frameScrub.holdDelayTimer || frameScrub.timer)) return;

        stopFrameScrub();
        frameScrub.direction = direction;
        frameScrub.mode = mode.name;
        stepFrame(direction, mode.frames);
        frameScrub.holdDelayTimer = setTimeout(function() {
            frameScrub.holdDelayTimer = null;
            if (!frameScrub.direction) return;

            frameScrub.timer = setInterval(function() {
                stepFrame(frameScrub.direction, mode.frames);
            }, mode.intervalMs);
        }, FRAME_SCRUBBING.holdDelayMs);
    }

    window.addEventListener('keyup', function(e) {
        if (getFrameShortcutDirection(e.code) || getFrameShortcutDirection(e.key)) {
            stopFrameScrub();
        }
    }, true);

    window.addEventListener('blur', stopFrameScrub);

    window.addEventListener('keydown', function(e) {
        // Ignore shortcuts if typing in input fields
        if (isTypingInField()) return;

        if (isPlaybackMenuOpen()) {
            if (isPlaybackMenuKey(e, 'down')) {
                e.preventDefault();
                e.stopPropagation();
                cyclePlaybackRate(1);
                return;
            }

            if (isPlaybackMenuKey(e, 'up')) {
                e.preventDefault();
                e.stopPropagation();
                cyclePlaybackRate(-1);
                return;
            }
        }

        const frameDirection = getFrameShortcutDirection(e.code) || getFrameShortcutDirection(e.key);
        if (frameDirection) {
            e.preventDefault();
            e.stopPropagation();
            startFrameScrub(frameDirection, getFrameStepMode(e));
            return;
        }

        // Use e.code for special keys like Space, and e.key for normal letters.
        const shortcut = SHORTCUTS[e.code] || SHORTCUTS[e.key.toLowerCase()];

        if (!shortcut) return;

        // Stop the page/site from treating Space as a focused click/next-video shortcut.
        e.preventDefault();
        e.stopPropagation();

        if (shortcut.type === 'playback-menu') {
            togglePlaybackMenu();
            return;
        }

        const btn = findShortcutButton(shortcut);
        if (btn) btn.click();
    }, true);
})();
