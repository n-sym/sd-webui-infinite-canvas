// 08_toast_and_progress.js

let icLastValidStep = "";
let icLastValidHue = "0";

let icToastWrapper = null;

function icInitToastWrapper() {
    if (document.getElementById('ic-toast-wrapper')) return;
    const container = document.getElementById('ic-container');
    if (!container) return;
    
    icToastWrapper = document.createElement('div');
    icToastWrapper.id = 'ic-toast-wrapper';
    icToastWrapper.style.cssText = `
        position: absolute;
        top: 56px;
        left: 20px;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
    `;
    container.appendChild(icToastWrapper);
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ic-toast-stripe {
            0% { background-position: 0 0; }
            100% { background-position: 30px 0; }
        }
        .ic-toast-bar-indeterminate {
            background-image: linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent) !important;
            background-size: 30px 30px !important;
            animation: ic-toast-stripe 1s linear infinite !important;
            width: 100% !important;
        }
    `;
    document.head.appendChild(style);
}

function icGetOrCreateToast(id, initialText = t("Processing..."), initialPct = "") {
    if (!icToastWrapper) icInitToastWrapper();
    let toast = document.getElementById(id);
    if (!toast) {
        toast = document.createElement('div');
        toast.id = id;
        toast.style.cssText = `
            display: none;
            flex-direction: column;
            min-width: 220px;
            padding: 12px 16px;
            border-radius: 10px;
            font-family: sans-serif;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            opacity: 0;
            transform: translateY(-10px);
        `;
        toast.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span class="ic-toast-text" style="font-size: 14px; font-weight: 600;">${initialText}</span>
                <span class="ic-toast-pct" style="font-size: 12px; font-weight: 700; opacity: 0.8;">${initialPct}</span>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.15); border-radius: 3px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">
                <div class="ic-toast-bar" style="width: 0%; height: 100%; transition: width 0.3s ease;"></div>
            </div>
        `;
        icToastWrapper.appendChild(toast);
    }
    return toast;
}

function icUpdateToastThemeForElement(toast, hue) {
    if (!toast) return;
    
    if (hue === 'white') {
        toast.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        toast.style.color = '#333333';
        toast.style.border = '1px solid rgba(0, 0, 0, 0.1)';
        toast.querySelector('.ic-toast-bar').style.backgroundColor = '#4CAF50';
        return;
    }
    
    const isDark = document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
    if (isDark) {
        toast.style.backgroundColor = `hsl(${hue}, 45%, 22%)`;
        toast.style.color = `#f0f0f0`;
        toast.style.border = `1px solid hsla(${hue}, 45%, 40%, 0.5)`;
        toast.querySelector('.ic-toast-bar').style.backgroundColor = `hsl(${hue}, 60%, 65%)`;
    } else {
        toast.style.backgroundColor = `hsl(${hue}, 85%, 92%)`;
        toast.style.color = `#333333`;
        toast.style.border = `1px solid hsla(${hue}, 85%, 75%, 0.8)`;
        toast.querySelector('.ic-toast-bar').style.backgroundColor = `hsl(${hue}, 60%, 45%)`;
    }
}

function icShowToast(id) {
    const toast = document.getElementById(id);
    if (!toast) return;
    if (toast.style.display === 'none') {
        toast.style.display = 'flex';
        // force reflow
        void toast.offsetWidth;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }
}

function icHideToast(id, removeAfter = false) {
    const toast = document.getElementById(id);
    if (!toast || toast.style.display === 'none') return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
        toast.style.display = 'none';
        if (removeAfter && toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// Ensure old compatibility layer maps correctly
function icInitProgressToast() {
    icInitToastWrapper();
}
function icUpdateToastTheme(hue) {
    icUpdateToastThemeForElement(document.getElementById('ic-progress-toast'), hue);
}

// Render one progress frame coming from either the WS push or the polling
// fallback. `data` shape: {active, textinfo, state:{sampling_step,sampling_steps}, progress}
window.icRenderProgressFrame = function(data) {
    if (!data) return;
    if (data.active) {
        const toast = icGetOrCreateToast('ic-progress-toast');
        icShowToast('ic-progress-toast');

        let customPct = -1;
        if (data.textinfo && data.textinfo.includes('|')) {
            const parts = data.textinfo.split('|');
            icLastValidStep = parts[0];
            icLastValidHue = parts[1];

            if (parts.length >= 4) {
                const totalSteps = parseInt(parts[2]);
                const accSteps = parseInt(parts[3]);
                if (totalSteps > 0 && data.state) {
                    const currentSamplingStep = data.state.sampling_step || 0;
                    const totalDone = accSteps + currentSamplingStep;
                    customPct = Math.max(0, Math.min(100, Math.round((totalDone / totalSteps) * 100)));
                }
            }
        }

        const txtElem = toast.querySelector('.ic-toast-text');
        const pctElem = toast.querySelector('.ic-toast-pct');
        const barElem = toast.querySelector('.ic-toast-bar');

        if (txtElem) txtElem.innerText = (typeof t === 'function' ? t(icLastValidStep) : icLastValidStep) || t("Processing...");

        const pct = customPct >= 0 ? customPct : Math.max(0, Math.min(100, Math.round(data.progress * 100)));
        if (pctElem) pctElem.innerText = pct + '%';
        if (barElem) {
            barElem.classList.remove('ic-toast-bar-indeterminate');
            barElem.style.width = pct + '%';
        }

        icUpdateToastThemeForElement(toast, icLastValidHue);
    } else {
        icHideToast('ic-progress-toast');
        icLastValidStep = "";
        // Job just went inactive — if a cancel was submitted, the backend has
        // now actually stopped, so dismiss the "Submitting cancel..." toast.
        if (window.icCancelling) {
            if (typeof icHideToast === 'function') icHideToast('ic-cancel-toast');
            window.icCancelling = false;
        }
    }
};

async function icPollProgress() {
    // Polling fallback — only used if the WS connection drops. While the WS is
    // alive, 05_api.js sets window.icWSAlive = true and we skip the fetch.
    if (window.icWSAlive) return;
    try {
        const res = await fetch('/infinite-canvas-api/progress', { method: 'GET' });
        const data = await res.json();
        window.icRenderProgressFrame(data);
    } catch (e) {
        // ignore fetch errors
    }
}

// Keep the old API signature but map to the new queue
window.icShowCustomToast = function(msg, duration=3000, hue=200, forceId=null) {
    const toastId = forceId || ('ic-custom-toast-' + Date.now());
    const toast = icGetOrCreateToast(toastId, msg, "");
    
    // Update text in case it already exists
    toast.querySelector('.ic-toast-text').innerText = msg;
    toast.querySelector('.ic-toast-pct').innerText = '';
    
    const barWrap = toast.querySelector('.ic-toast-bar').parentNode;
    if (duration > 0) {
        barWrap.style.display = 'none';
        toast.children[0].style.marginBottom = '0px';
    } else {
        barWrap.style.display = 'block';
        toast.children[0].style.marginBottom = '10px';
        toast.querySelector('.ic-toast-bar').classList.add('ic-toast-bar-indeterminate');
    }
    
    icUpdateToastThemeForElement(toast, hue);
    icShowToast(toastId);
    
    if (duration > 0) {
        setTimeout(() => {
            icHideToast(toastId, true);
        }, duration);
    }
    return toastId; // Return ID so it can be managed if needed
};

window.icRenderToastState = function() {
    // This is exclusively for Autosave tracking now!
    if (window.icAutosaveStatusVal === 'saving') {
        const toast = icGetOrCreateToast('ic-autosave-toast');
        toast.querySelector('.ic-toast-text').innerText = t("Autosaving...");
        toast.querySelector('.ic-toast-pct').innerText = '';
        toast.querySelector('.ic-toast-bar').classList.add('ic-toast-bar-indeterminate');
        icUpdateToastThemeForElement(toast, 'white');
        icShowToast('ic-autosave-toast');
        if (window.icAutosaveToastTimeout) clearTimeout(window.icAutosaveToastTimeout);
    } else if (window.icAutosaveStatusVal === 'done') {
        const toast = icGetOrCreateToast('ic-autosave-toast');
        toast.querySelector('.ic-toast-text').innerText = t("Autosaved successfully!");
        toast.querySelector('.ic-toast-pct').innerText = '';
        toast.querySelector('.ic-toast-bar').parentNode.style.display = 'none';
        toast.children[0].style.marginBottom = '0px';
        icUpdateToastThemeForElement(toast, 'white');
        icShowToast('ic-autosave-toast');
        if (window.icAutosaveToastTimeout) clearTimeout(window.icAutosaveToastTimeout);
    } else {
        icHideToast('ic-autosave-toast');
    }
};

function _initICProgressRunner() {
    const icOutput = document.getElementById('ic-container');
    if (!icOutput) {
        setTimeout(_initICProgressRunner, 500);
        return;
    }
    
    if (!window.icProgressInitialized) {
        window.icProgressInitialized = true;
        
        setTimeout(() => {
            icInitToastWrapper();
            
            // Hide native progress bar globally inside our extension output
            const style = document.createElement('style');
            style.textContent = `
                #ic-container .progress { display: none !important; }
                #ic-container .progress-container { display: none !important; }
                #ic-container .progressDiv { display: none !important; }
                #ic-container .wrap { border: none !important; box-shadow: none !important; background: transparent !important; }
                #ic-container .progress-text { display: none !important; }
                #ic_output .progress { display: none !important; }
                #ic_output .progress-container { display: none !important; }
                #ic_output .progressDiv { display: none !important; }
            `;
            document.head.appendChild(style);
            
            setInterval(() => {
                icPollProgress();
            }, 500);
        }, 1000);
    }
}

_initICProgressRunner();
