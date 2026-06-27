// --- WebUI Compatibility & Hacks ---

// WebUI's built-in localization.js aggressively translates ALL text nodes via MutationObserver.
// It ignores `class="notranslate"` and `translate="no"`.
// We monkey-patch its `canBeTranslated` function to respect standard translation-blocking attributes.
(function() {
    function patchCanBeTranslated(original) {
        return function(node, text) {
            if (node && node.parentElement && node.parentElement.closest) {
                if (node.parentElement.closest('.notranslate, [translate="no"]')) {
                    return false;
                }
            }
            return original.apply(this, arguments);
        };
    }

    if (typeof window.canBeTranslated === 'function') {
        window.canBeTranslated = patchCanBeTranslated(window.canBeTranslated);
    } else {
        let _canBeTranslated;
        Object.defineProperty(window, 'canBeTranslated', {
            get: function() { return _canBeTranslated; },
            set: function(val) {
                if (typeof val === 'function' && val.name !== '') { // Avoid infinite recursion if patched again
                    _canBeTranslated = patchCanBeTranslated(val);
                } else {
                    _canBeTranslated = val;
                }
            },
            configurable: true
        });
    }
})();
