// 08_progress.js

let icProgressInterval = null;
let icLastValidStep = "";
let icLastValidHue = "0";
let icToastContainer = null;

function icInitProgressToast() {
    if (document.getElementById('ic-progress-toast')) return;
    
    const container = document.getElementById('ic-container');
    if (!container) return;
    
    icToastContainer = document.createElement('div');
    icToastContainer.id = 'ic-progress-toast';
    icToastContainer.style.cssText = `
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 2000;
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
        pointer-events: none;
    `;
    
    icToastContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span id="ic-toast-text" style="font-size: 14px; font-weight: 600;">Processing...</span>
            <span id="ic-toast-pct" style="font-size: 12px; font-weight: 700; opacity: 0.8;">0%</span>
        </div>
        <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.15); border-radius: 3px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);">
            <div id="ic-toast-bar" style="width: 0%; height: 100%; transition: width 0.3s ease;"></div>
        </div>
    `;
    
    container.appendChild(icToastContainer);
}

function icUpdateToastTheme(hue) {
    if (!icToastContainer) return;
    
    const isDark = document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
    if (isDark) {
        icToastContainer.style.backgroundColor = `hsl(${hue}, 45%, 22%)`;
        icToastContainer.style.color = `#f0f0f0`;
        icToastContainer.style.border = `1px solid hsla(${hue}, 45%, 40%, 0.5)`;
        document.getElementById('ic-toast-bar').style.backgroundColor = `hsl(${hue}, 80%, 65%)`;
    } else {
        icToastContainer.style.backgroundColor = `hsl(${hue}, 85%, 92%)`;
        icToastContainer.style.color = `hsl(${hue}, 85%, 25%)`;
        icToastContainer.style.border = `1px solid hsla(${hue}, 85%, 75%, 0.8)`;
        document.getElementById('ic-toast-bar').style.backgroundColor = `hsl(${hue}, 80%, 45%)`;
    }
}

async function icPollProgress() {
    if (!window.ic_current_task_id) return;
    try {
        const res = await fetch('/internal/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_task: window.ic_current_task_id,
                id_live_preview: -1
            })
        });
        const data = await res.json();
        
        if (data.active) {
            icToastContainer.style.display = 'flex';
            
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
            
            const txtElem = document.getElementById('ic-toast-text');
            const pctElem = document.getElementById('ic-toast-pct');
            const barElem = document.getElementById('ic-toast-bar');
            
            if (txtElem) txtElem.innerText = (typeof t === 'function' ? t(icLastValidStep) : icLastValidStep) || "Processing...";
            
            const pct = customPct >= 0 ? customPct : Math.max(0, Math.min(100, Math.round(data.progress * 100)));
            if (pctElem) pctElem.innerText = pct + '%';
            if (barElem) barElem.style.width = pct + '%';
            
            icUpdateToastTheme(icLastValidHue);
            
        } else {
            if (icToastContainer.style.display !== 'none') {
                setTimeout(() => {
                    icToastContainer.style.display = 'none';
                    icLastValidStep = "";
                }, 500);
            }
        }
    } catch (e) {
        // ignore fetch errors
    }
}

function _initICProgressRunner() {
    const icOutput = document.getElementById('ic_output');
    if (!icOutput) {
        setTimeout(_initICProgressRunner, 500);
        return;
    }
    
    if (!window.icProgressInitialized) {
        window.icProgressInitialized = true;
        
        setTimeout(() => {
            icInitProgressToast();
            
            // Hide native progress bar globally inside our extension output
            const style = document.createElement('style');
            style.textContent = `
                #ic_output .progress { display: none !important; }
                #ic_output .progress-container { display: none !important; }
                #ic_output .progressDiv { display: none !important; }
                #ic_output .wrap { border: none !important; box-shadow: none !important; background: transparent !important; }
                #ic_output .progress-text { display: none !important; }
            `;
            document.head.appendChild(style);
            
            setInterval(() => {
                if (window.ic_current_task_id) {
                    icPollProgress();
                }
            }, 500);
        }, 1000);
    }
}

_initICProgressRunner();
