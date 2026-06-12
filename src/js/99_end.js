}

function ic_setRes(w, h) {
    const wEl = document.querySelector('#ic_gen_width input[type="number"]');
    const hEl = document.querySelector('#ic_gen_height input[type="number"]');
    const wRange = document.querySelector('#ic_gen_width input[type="range"]');
    const hRange = document.querySelector('#ic_gen_height input[type="range"]');
    
    if (wEl) { wEl.value = w; wEl.dispatchEvent(new Event('input', {bubbles: true})); }
    if (wRange) { wRange.value = w; wRange.dispatchEvent(new Event('input', {bubbles: true})); }
    
    if (hEl) { hEl.value = h; hEl.dispatchEvent(new Event('input', {bubbles: true})); }
    if (hRange) { hRange.value = h; hRange.dispatchEvent(new Event('input', {bubbles: true})); }
    if (typeof draw === 'function') draw();
}
