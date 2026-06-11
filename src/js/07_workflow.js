// 07_workflow.js

const workflowStyle = document.createElement('style');
workflowStyle.textContent = `
    .ic-pipeline-node {
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s ease;
        /* Default to Light Mode (Cute Pastel) */
        background-color: hsl(var(--node-hue), 85%, 92%);
        color: hsl(var(--node-hue), 85%, 25%);
        border: 1px solid hsla(var(--node-hue), 85%, 75%, 0.8);
        box-shadow: inset 0 0 5px rgba(255,255,255,0.5), 0 1px 3px rgba(0,0,0,0.05);
    }
    
    /* Dark Mode */
    .dark .ic-pipeline-node {
        background-color: hsl(var(--node-hue), 45%, 22%);
        color: #f0f0f0;
        border: 1px solid hsla(var(--node-hue), 45%, 40%, 0.5);
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
        border-radius: 8px !important;
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

// Poll the hidden output textarea to catch the response
setInterval(() => {
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
}, 500);

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
    let settingsHtml = `<div style="margin-top: 15px; border-top: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); padding-top: 10px;">`;
    settingsHtml += `<h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: var(--body-text-color-subdued, #888);">${t('Plugin Settings')}</h4>`;

    registry.forEach(plugin => {
        if (!plugin.is_plugin) return;
        
        settingsHtml += `<div style="margin-bottom: 10px; padding: 12px; background: var(--background-fill-secondary, rgba(128,128,128,0.1)); border-radius: 8px; border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`;
        settingsHtml += `<div style="font-weight: 600; margin-bottom: 8px; font-size: 14px; color: var(--body-text-color, #fff);">${t(plugin.name)}</div>`;
        
        const pValues = stepParams[plugin.id] || {};
        
        let isPluginEnabled = true;
        const enabledParam = plugin.params.find(p => p.name === 'enabled');
        if (enabledParam) {
            isPluginEnabled = pValues['enabled'] !== undefined ? pValues['enabled'] : enabledParam.default;
        }
        
        let enabledParamHtml = '';
        let otherParamsHtml = '';
        
        plugin.params.forEach(param => {
            const val = pValues[param.name] !== undefined ? pValues[param.name] : param.default;
            
            let htmlChunk = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: var(--body-text-color, #ccc);">`;
            htmlChunk += `<span>${t(param.label)}</span>`;
            
            if (param.type === 'bool') {
                if (param.name === 'enabled') {
                    htmlChunk += `<input type="checkbox" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" ${val ? 'checked' : ''} style="cursor: pointer;" onchange="const wrap = document.getElementById('ic_plugin_params_${plugin.id}'); if(wrap) { wrap.style.maxHeight = this.checked ? '1000px' : '0px'; wrap.style.opacity = this.checked ? '1' : '0'; } sendWorkflowUpdate()" />`;
                } else {
                    htmlChunk += `<input type="checkbox" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" ${val ? 'checked' : ''} style="cursor: pointer;" onchange="sendWorkflowUpdate()" />`;
                }
            } else if (param.type === 'float' || param.type === 'int') {
                htmlChunk += `<div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; padding-left: 10px;">`;
                htmlChunk += `<input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="flex: 1; min-width: 60px; max-width: 150px; cursor: pointer;" oninput="this.nextElementSibling.value=this.value" onchange="this.nextElementSibling.value=this.value; sendWorkflowUpdate()" />`;
                htmlChunk += `<input type="number" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="width: 55px; text-align: center; font-family: monospace; background: var(--background-fill-primary, rgba(0,0,0,0.1)); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 2px; border-radius: 3px; outline: none;" oninput="this.previousElementSibling.value=this.value" onchange="sendWorkflowUpdate()" />`;
                htmlChunk += `</div>`;
            } else if (param.type === 'string' || param.type === 'password') {
                const inputType = param.type === 'password' ? 'password' : 'text';
                htmlChunk += `<input type="${inputType}" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" value="${val}" style="flex: 1; min-width: 0; background: var(--background-fill-primary, rgba(0,0,0,0.1)); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px 6px; border-radius: 4px;" onchange="sendWorkflowUpdate()" />`;
            } else if (param.type === 'enum') {
                htmlChunk += `<select class="ic-node-param ic-select" data-node-id="${plugin.id}" data-param-name="${param.name}" style="flex: 1; max-width: 140px; margin-left: 10px;" onchange="sendWorkflowUpdate()">`;
                param.choices.forEach(c => {
                    htmlChunk += `<option value="${c}" ${c === val ? 'selected' : ''}>${c}</option>`;
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
            settingsHtml += `<div id="ic_plugin_params_${plugin.id}" style="transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; overflow: hidden; max-height: ${isPluginEnabled ? '1000px' : '0px'}; opacity: ${isPluginEnabled ? '1' : '0'};">`;
            settingsHtml += otherParamsHtml;
            settingsHtml += `</div>`;
        }
        settingsHtml += `</div>`;
    });
    settingsHtml += `</div>`;

    container.innerHTML = html + settingsHtml;
}

window.sendWorkflowUpdate = function() {
    const stepParams = {};
    document.querySelectorAll('.ic-node-param').forEach(input => {
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
    return `<div class="ic-pipeline-node" style="--node-hue: ${hue};">
        ${text}
    </div>`;
}
