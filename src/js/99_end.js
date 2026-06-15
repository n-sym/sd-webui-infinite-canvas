}

function ic_setRes(w, h) {
    // Width/Height are now ParseInputStep params (.ic-node-param under
    // data-node-id="parse_input"). Each has a number input + a sibling range
    // slider (range is previousElementSibling per renderParamRow in 07_workflow).
    const wNum = document.querySelector('.ic-node-param[data-node-id="parse_input"][data-param-name="gen_width"]');
    const hNum = document.querySelector('.ic-node-param[data-node-id="parse_input"][data-param-name="gen_height"]');
    const wRange = wNum && wNum.previousElementSibling && wNum.previousElementSibling.type === 'range' ? wNum.previousElementSibling : null;
    const hRange = hNum && hNum.previousElementSibling && hNum.previousElementSibling.type === 'range' ? hNum.previousElementSibling : null;

    if (wNum) { wNum.value = w; wNum.dispatchEvent(new Event('input', {bubbles: true})); wNum.dispatchEvent(new Event('change', {bubbles: true})); }
    if (wRange) { wRange.value = w; wRange.dispatchEvent(new Event('input', {bubbles: true})); }

    if (hNum) { hNum.value = h; hNum.dispatchEvent(new Event('input', {bubbles: true})); hNum.dispatchEvent(new Event('change', {bubbles: true})); }
    if (hRange) { hRange.value = h; hRange.dispatchEvent(new Event('input', {bubbles: true})); }
    if (typeof draw === 'function') draw();
}
