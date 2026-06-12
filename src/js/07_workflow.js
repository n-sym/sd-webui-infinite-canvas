// 07_workflow.js

const workflowStyle = document.createElement('style');
workflowStyle.textContent = `
    .ic-pipeline-node {
        padding: 8px 12px;
        border-radius: 16px;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s ease;
        /* Default to Light Mode (Cute Pastel) */
        background-color: hsl(var(--node-hue), 85%, 92%);
        color: hsl(var(--node-hue), 85%, 25%);
        --ic-border-color: hsla(var(--node-hue), 85%, 70%, 0.8);
        --ic-glow-color: hsla(var(--node-hue), 85%, 98%, 0.9);
        box-shadow: inset 0 0 5px rgba(255,255,255,0.5), 0 1px 3px rgba(0,0,0,0.05);
    }
    
    /* Dark Mode */
    .dark .ic-pipeline-node {
        background-color: hsl(var(--node-hue), 45%, 22%);
        color: #f0f0f0;
        --ic-border-color: hsla(var(--node-hue), 45%, 45%, 0.8);
        --ic-glow-color: hsla(var(--node-hue), 45%, 70%, 0.6);
        box-shadow: inset 0 0 5px rgba(0,0,0,0.2);
    }
    
    .ic-select {
        width: 120px !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        background-color: var(--background-fill-primary, rgba(0,0,0,0.05)) !important;
        border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)) !important;
        color: var(--body-text-color, #fff) !important;
        padding: 6px 28px 6px 10px !important;
        border-radius: 16px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        background-image: url('data:image/svg+xml;utf8,<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>') !important;
        background-repeat: no-repeat !important;
        background-position: right 10px center !important;
        background-size: 10px !important;
        box-shadow: inset 0 1px 2px rgba(255,255,255,0.05), 0 1px 3px rgba(0,0,0,0.05) !important;
    }
    
    .ic-select:hover {
        background-color: var(--background-fill-secondary, rgba(0,0,0,0.08)) !important;
        border-color: var(--border-color-hover, rgba(128,128,128,0.4)) !important;
    }
    
    .ic-select:focus {
        outline: none !important;
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
    }
    
    .dark .ic-select {
        background-color: rgba(255,255,255,0.05) !important;
    }
    
    .dark .ic-select:hover {
        background-color: rgba(255,255,255,0.08) !important;
    }
`;
document.head.appendChild(workflowStyle);

let lastQueryPayload = "";

// Initial query on init
setTimeout(() => {
    let queryBtn = document.getElementById("ic_query_workflow_btn");
    if (queryBtn) {
        if (queryBtn.tagName !== 'BUTTON') {
            const innerBtn = queryBtn.querySelector('button');
            if (innerBtn) queryBtn = innerBtn;
        }
        queryBtn.click();
    }
}, 1500);

// Watch the hidden output textarea for workflow responses via MutationObserver
const workflowOutputEl = document.getElementById("ic_output");
const handleWorkflowOutput = () => {
    const outputElem = document.querySelector("#ic_output textarea");
    const htmlContainer = document.getElementById("ic_workflow_html");

    if (!outputElem || !htmlContainer) return;

    const val = outputElem.value;
    if (!val || val === lastQueryPayload) return;

    try {
        const data = JSON.parse(val);
        if (data.type === "workflow_query") {
            lastQueryPayload = val;
            updateWorkflowUI(data, htmlContainer);
        }
    } catch (e) {
        // ignore parsing errors
    }
};
if (workflowOutputEl) {
    const workflowObserver = new MutationObserver(handleWorkflowOutput);
    workflowObserver.observe(workflowOutputEl, { childList: true, subtree: true, attributes: true, characterData: true });
}

function updateWorkflowUI(data, container) {
    if (!data || !data.registry) return;
    
    const activeWorkflow = data.workflow || [];
    const stepParams = data.step_params || {};
    const registry = data.registry || [];
    
    // Build raw HTML
    let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
    
    registry.forEach(node => {
        // Calculate a color hue based on sort_index
        const hue = node.sort_index % 360;
        
        if (!node.is_plugin) {
            // Core node
            html += createNodeHtml(t(node.name), hue);
        } else {
            // Plugin node
            const pValues = stepParams[node.id] || {};
            if (pValues.enabled) {
                html += createNodeHtml(t(node.name), hue);
            }
        }
    });
    
    html += `</div>`;
    
    // Build Settings HTML
    let settingsHtml = `<div style="padding-top: 55px;">`;
    // (Heading removed per user request)

    registry.forEach(plugin => {
        if (!plugin.is_plugin) return;
        
        settingsHtml += `<div class="ic-plugin-setting-group fluent-card" style="margin-bottom: 10px; padding: 12px; background: var(--background-fill-secondary, rgba(128,128,128,0.1)); border-radius: 16px; cursor: pointer; border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2));" onclick="if(event.target.closest('input') || event.target.closest('select')) return; const cb = this.querySelector('input[data-param-name=\\'enabled\\']'); if(cb) cb.click();">`;
        settingsHtml += `<div class="fluent-content" style="width:100%; height:100%;">`;
        const pValues = stepParams[plugin.id] || {};
        
        let isPluginEnabled = true;
        const enabledParam = plugin.params.find(p => p.name === 'enabled');
        if (enabledParam) {
            isPluginEnabled = pValues['enabled'] !== undefined ? pValues['enabled'] : enabledParam.default;
        }

        settingsHtml += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">`;
        settingsHtml += `<div style="font-weight: 600; font-size: 14px; color: var(--body-text-color, #fff);">${t(plugin.name)}</div>`;
        if (enabledParam) {
            settingsHtml += `<input type="checkbox" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="enabled" ${isPluginEnabled ? 'checked' : ''} style="cursor: pointer;" onchange="const wraps = document.querySelectorAll('.ic_plugin_params_${plugin.id}'); wraps.forEach(w => { w.style.maxHeight = this.checked ? '1000px' : '0px'; w.style.opacity = this.checked ? '1' : '0'; }); sendWorkflowUpdate(this)" />`;
        }
        settingsHtml += `</div>`;
        
        let enabledParamHtml = '';
        let otherParamsHtml = '';
        
        plugin.params.forEach(param => {
            if (param.name === 'enabled') return;
            
            const val = pValues[param.name] !== undefined ? pValues[param.name] : param.default;
            
            let htmlChunk = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: var(--body-text-color, #ccc);">`;
            htmlChunk += `<span style="flex-shrink: 0; margin-right: 15px;">${t(param.label)}</span>`;
            
            if (param.type === 'bool') {
                htmlChunk += `<input type="checkbox" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" ${val ? 'checked' : ''} style="cursor: pointer;" onchange="sendWorkflowUpdate(this)" />`;
            } else if (param.type === 'float' || param.type === 'int') {
                htmlChunk += `<div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; padding-left: 10px;">`;
                htmlChunk += `<input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="flex: 1; min-width: 60px; max-width: 150px; cursor: pointer;" oninput="this.nextElementSibling.value=this.value" onchange="this.nextElementSibling.value=this.value; sendWorkflowUpdate(this.nextElementSibling)" />`;
                htmlChunk += `<input type="number" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="width: 55px; text-align: center; font-family: monospace; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px 2px; border-radius: 16px; font-size: 11px; outline: none; box-shadow: none !important; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" oninput="this.previousElementSibling.value=this.value" onchange="sendWorkflowUpdate(this)" />`;
                htmlChunk += `</div>`;
            } else if (param.type === 'string' || param.type === 'password') {
                const inputType = param.type === 'password' ? 'password' : 'text';
                htmlChunk += `<input type="${inputType}" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" value="${val}" style="flex: 0 0 260px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 6px 8px; border-radius: 16px; font-size: 11px; outline: none; box-shadow: none !important; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" onchange="sendWorkflowUpdate(this)" />`;
            } else if (param.type === 'enum') {
                htmlChunk += `<select class="ic-node-param ic-select" data-node-id="${plugin.id}" data-param-name="${param.name}" style="flex: 1; max-width: 140px; margin-left: 10px; font-size: 11px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px; border-radius: 16px; outline: none; box-shadow: none !important; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" onchange="sendWorkflowUpdate(this)">`;
                param.choices.forEach(c => {
                    const displayChoice = typeof t === 'function' ? t(c) : c;
                    htmlChunk += `<option value="${c}" ${c === val ? 'selected' : ''}>${displayChoice}</option>`;
                });
                htmlChunk += `</select>`;
            }
            
            htmlChunk += `</div>`;
            
            if (param.name === 'enabled') {
                enabledParamHtml += htmlChunk;
            } else {
                otherParamsHtml += htmlChunk;
            }
        });
        
        settingsHtml += enabledParamHtml;
        if (otherParamsHtml) {
            settingsHtml += `<div class="ic_plugin_params_${plugin.id}" style="transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; overflow: hidden; max-height: ${isPluginEnabled ? '1000px' : '0px'}; opacity: ${isPluginEnabled ? '1' : '0'};">`;
            settingsHtml += otherParamsHtml;
            settingsHtml += `</div>`;
        }
        settingsHtml += `</div></div>`;
    });
    settingsHtml += `</div>`;

    container.innerHTML = html + settingsHtml;
    
    // Also update the canvas overlay if it exists
    const overlayList = document.getElementById('ic-nodes-list-col');
    const overlaySettings = document.getElementById('ic-nodes-settings-col');
    if (overlayList) overlayList.innerHTML = html;
    if (overlaySettings) overlaySettings.innerHTML = settingsHtml;
    
    // Re-apply search filter if there's text in the search box
    const searchInput = document.getElementById('ic-nodes-search');
    if (searchInput && searchInput.value) {
        searchInput.dispatchEvent(new Event('input'));
    }
}

window.sendWorkflowUpdate = function(changedElem) {
    if (changedElem) {
        const nodeId = changedElem.getAttribute('data-node-id');
        const paramName = changedElem.getAttribute('data-param-name');
        let val = (changedElem.type === 'checkbox') ? changedElem.checked : changedElem.value;
        document.querySelectorAll(`.ic-node-param[data-node-id="${nodeId}"][data-param-name="${paramName}"]`).forEach(el => {
            if (el !== changedElem) {
                if (el.type === 'checkbox') el.checked = val;
                else el.value = val;
                
                // if it's a number/range pair, update the sibling too
                if (el.type === 'number' && el.previousElementSibling && el.previousElementSibling.type === 'range') el.previousElementSibling.value = val;
                if (el.type === 'range' && el.nextElementSibling && el.nextElementSibling.type === 'number') el.nextElementSibling.value = val;
            }
        });
    }

    const stepParams = {};
    // We only need to iterate over one set of inputs to build stepParams.
    // The sidebar container is a good source of truth.
    const container = document.getElementById('ic_workflow_html');
    if (!container) return;
    
    container.querySelectorAll('.ic-node-param').forEach(input => {
        const nodeId = input.getAttribute('data-node-id');
        const paramName = input.getAttribute('data-param-name');
        if (!nodeId || !paramName) return;
        
        let val;
        if (input.type === 'checkbox') val = input.checked;
        else if (input.type === 'range' || input.type === 'number') val = parseFloat(input.value);
        else val = input.value;
        
        if (!stepParams[nodeId]) stepParams[nodeId] = {};
        stepParams[nodeId][paramName] = val;
    });
    
    const payloadInput = document.querySelector('#ic_update_workflow_payload textarea') || document.querySelector('#ic_update_workflow_payload input');
    let updateBtn = document.getElementById('ic_update_workflow_btn');
    
    if (updateBtn && updateBtn.tagName !== 'BUTTON') {
        const innerBtn = updateBtn.querySelector('button');
        if (innerBtn) {
            updateBtn = innerBtn;
        }
    }
    
    if (payloadInput && updateBtn) {
        payloadInput.value = JSON.stringify({ step_params: stepParams });
        payloadInput.dispatchEvent(new Event('input', { bubbles: true }));
        updateBtn.click();
    }
}

function createNodeHtml(text, hue) {
    return `<div class="ic-pipeline-node fluent-card" style="--node-hue: ${hue};">
        <div class="fluent-content">${text}</div>
    </div>`;
}
