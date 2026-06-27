// 12_menu.js
// PILOT (route B): library-driven menu behavior.
// Floating UI (vendored UMD in javascript/) owns the hard part — submenu/dropdown
// positioning with viewport-edge flip/shift. We still own the cheap interaction
// glue below (open/close, hover-switch, click-outside, Esc). This file is the
// measuring stick for the A-vs-B decision: count the lines we had to write.
//
// Appearance is unchanged — all .ic-menu-* CSS in 01_state.js is preserved.
// Only the open/close MECHANISM moved from CSS :hover to JS control.

(function ic_initMenuController() {
    const FUI = window.FloatingUIDOM;
    const menuBar = document.getElementById('ic-menu-bar');
    if (!menuBar) return;

    // Graceful degradation: if the vendored lib failed to load (offline edge
    // case), re-enable the original CSS :hover behavior so the menu still works.
    if (!FUI || !FUI.computePosition) {
        console.warn('[Infinite Canvas] FloatingUI not loaded — menu falls back to CSS hover.');
        menuBar.classList.add('ic-menu-css-fallback');
        return;
    }

    const groups = Array.from(menuBar.querySelectorAll('.ic-menu-item-group'));
    let openGroup = null;

    function place(reference, floating, placement) {
        // Set position fixed BEFORE computePosition so it's measured relative to viewport,
        // preventing incorrect dimensions when constrained by relative parent.
        floating.style.position = 'fixed';
        floating.style.display = 'flex';
        FUI.computePosition(reference, floating, {
            strategy: 'fixed',
            placement: placement,
            middleware: [FUI.offset(4), FUI.flip({ padding: 8 }), FUI.shift({ padding: 8 })],
        }).then(({ x, y }) => {
            Object.assign(floating.style, { left: `${x}px`, top: `${y}px` });
        });
    }

    function closeAll() {
        groups.forEach(g => {
            const d = g.querySelector('.ic-menu-dropdown');
            if (d) d.style.display = 'none';
            g.classList.remove('ic-menu-open');
        });
        menuBar.querySelectorAll('.ic-submenu').forEach(s => (s.style.display = 'none'));
        openGroup = null;
    }
    window.ic_close_menu = closeAll;

    function openMenu(group) {
        if (openGroup === group) return;
        closeAll();
        const label = group.querySelector('.ic-menu-item-label');
        const dropdown = group.querySelector('.ic-menu-dropdown');
        if (!label || !dropdown) return;
        place(group, dropdown, 'bottom-start');
        group.classList.add('ic-menu-open');
        openGroup = group;
    }

    groups.forEach(group => {
        const label = group.querySelector('.ic-menu-item-label');
        if (!label) return;

        // Click a top-level label to toggle; classic menubar hover-switch once open.
        label.addEventListener('click', e => {
            e.stopPropagation();
            openGroup === group ? closeAll() : openMenu(group);
        });
        label.addEventListener('mouseenter', () => {
            if (openGroup && openGroup !== group) openMenu(group);
        });

        // Submenus: position on hover, flip to the left side near the viewport edge.
        group.querySelectorAll('.ic-has-submenu').forEach(item => {
            const sub = item.querySelector('.ic-submenu');
            if (!sub) return;
            item.addEventListener('mouseenter', () => place(item, sub, 'right-start'));
            item.addEventListener('mouseleave', () => (sub.style.display = 'none'));
        });
    });

    // Delegated so dynamically-inserted actions (e.g. the project list) close too.
    menuBar.addEventListener('click', e => {
        const action = e.target.closest('.ic-menu-action');
        if (action && !action.classList.contains('ic-has-submenu')) closeAll();
    });

    document.addEventListener('click', e => {
        if (openGroup && !menuBar.contains(e.target)) closeAll();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeAll();
    });
})();
