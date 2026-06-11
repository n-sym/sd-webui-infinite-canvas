// 07_workflow.js

// 07_workflow.js

// 07_workflow.js

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
        const bgColor = `hsl(${hue}, 45%, 22%)`;
        
        if (!node.is_plugin) {
            // Core node
            html += createNodeHtml(t(node.name), bgColor);
        } else {
            // Plugin node
            const pValues = stepParams[node.id] || {};
            if (pValues.enabled) {
                html += createNodeHtml(t(node.name), bgColor);
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
        
        plugin.params.forEach(param => {
            const val = pValues[param.name] !== undefined ? pValues[param.name] : param.default;
            
            settingsHtml += `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: var(--body-text-color, #ccc);">`;
            settingsHtml += `<span>${t(param.label)}</span>`;
            
            if (param.type === 'bool') {
                settingsHtml += `<input type="checkbox" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" ${val ? 'checked' : ''} style="cursor: pointer;" onchange="sendWorkflowUpdate()" />`;
            } else if (param.type === 'float' || param.type === 'int') {
                settingsHtml += `<div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; padding-left: 10px;">`;
                settingsHtml += `<input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="flex: 1; min-width: 60px; max-width: 150px; cursor: pointer;" oninput="this.nextElementSibling.value=this.value" onchange="this.nextElementSibling.value=this.value; sendWorkflowUpdate()" />`;
                settingsHtml += `<input type="number" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="width: 55px; text-align: center; font-family: monospace; background: var(--background-fill-primary, rgba(0,0,0,0.1)); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 2px; border-radius: 3px; outline: none;" oninput="this.previousElementSibling.value=this.value" onchange="sendWorkflowUpdate()" />`;
                settingsHtml += `</div>`;
            } else if (param.type === 'string' || param.type === 'password') {
                const inputType = param.type === 'password' ? 'password' : 'text';
                settingsHtml += `<input type="${inputType}" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" value="${val}" style="flex: 1; min-width: 0; background: var(--background-fill-primary, rgba(0,0,0,0.1)); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px 6px; border-radius: 4px;" onchange="sendWorkflowUpdate()" />`;
            } else if (param.type === 'enum') {
                settingsHtml += `<select class="ic-node-param" data-node-id="${plugin.id}" data-param-name="${param.name}" style="width: 120px; background: var(--background-fill-primary, rgba(0,0,0,0.1)); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px 6px; border-radius: 4px;" onchange="sendWorkflowUpdate()">`;
                param.choices.forEach(c => {
                    settingsHtml += `<option value="${c}" ${c === val ? 'selected' : ''}>${c}</option>`;
                });
                settingsHtml += `</select>`;
            }
            
            settingsHtml += `</div>`;
        });
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

function createNodeHtml(text, bgColor) {
    return `<div style="padding: 8px 12px; background-color: ${bgColor}; border-radius: 6px; font-size: 13px; color: #fff; box-shadow: inset 0 0 5px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1);">
        ${text}
    </div>`;
}

