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

    /* Sidebar collapsible plugin cards */
    .ic-sidebar-plugin-card {
        margin-bottom: 10px;
        padding: 10px 12px;
        background: var(--background-fill-secondary, rgba(128,128,128,0.1));
        border-radius: 14px;
        border: 1px solid hsla(var(--node-hue), 45%, 55%, 0.5);
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .dark .ic-sidebar-plugin-card {
        border-color: hsla(var(--node-hue), 45%, 45%, 0.5);
    }
    .ic-sidebar-plugin-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        font-weight: 600;
        font-size: 13px;
        color: hsl(var(--node-hue), 85%, 25%);
    }
    .dark .ic-sidebar-plugin-header {
        color: hsl(var(--node-hue), 45%, 80%);
    }
    .ic-sidebar-plugin-chevron {
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
        opacity: 0.7;
    }
    /* collapsed => rotated; expanded => rotate(0) applied inline */
    .ic-sidebar-plugin-body {
        transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
        overflow: hidden;
    }
`;
document.head.appendChild(workflowStyle);

let lastQueryPayload = "";

// Initial query on init
setTimeout(async () => {
    try {
        const res = await fetch('/infinite-canvas-api/workflow');
        const data = await res.json();
        if (window.ic_handle_workflow_output) {
            window.ic_handle_workflow_output(data);
        }
    } catch (e) {
        console.error("Failed to query workflow on startup:", e);
    }
}, 1500);

window.ic_handle_workflow_output = function(data) {
    const htmlContainer = document.getElementById("ic_workflow_html");
    if (!htmlContainer) return;

    if (data && data.type === "workflow_query") {
        updateWorkflowUI(data, htmlContainer);
    }
};

// Build ONE param input row. Reused by both the settings column and the
// sidebar so the two views can never drift apart in markup. Returns an HTML
// string for a single param. `pluginId` + `param` + current `val`.
function renderParamRow(pluginId, param, val) {
    // 'text' params (prompt, tags, …) need a vertical block: label above a
    // full-width auto-resizing textarea. Return early so the standard
    // horizontal label/input row below isn't applied.
    if (param.type === 'text') {
        const escaped = String(val == null ? '' : val)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        return `<div style="margin-bottom: 10px; font-size: 13px; color: var(--body-text-color, #ccc);">
            <div style="margin-bottom: 4px; font-weight: 600;">${t(param.label)}</div>
            <textarea class="ic-node-param" data-node-id="${pluginId}" data-param-name="${param.name}" rows="2" style="width: 100%; box-sizing: border-box; resize: none; min-height: 32px; overflow: hidden; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 6px 8px; border-radius: 12px; font-size: 11px; font-family: sans-serif; outline: none; box-shadow: none !important; transition: border-color 0.2s; line-height: 1.4;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" oninput="this.style.height='auto';this.style.height=Math.max(32,this.scrollHeight)+'px';" onchange="sendWorkflowUpdate(this)">${escaped}</textarea>
        </div>`;
    }

    let htmlChunk = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: var(--body-text-color, #ccc);">`;
    htmlChunk += `<span style="flex-shrink: 0; margin-right: 15px;">${t(param.label)}</span>`;

    if (param.type === 'bool') {
        htmlChunk += `<input type="checkbox" class="ic-node-param" data-node-id="${pluginId}" data-param-name="${param.name}" ${val ? 'checked' : ''} style="cursor: pointer;" onchange="sendWorkflowUpdate(this)" />`;
    } else if (param.type === 'float' || param.type === 'int') {
        htmlChunk += `<div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end; padding-left: 10px;">`;
        htmlChunk += `<input type="range" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="flex: 1; min-width: 60px; max-width: 150px; cursor: pointer;" oninput="this.nextElementSibling.value=this.value" onchange="this.nextElementSibling.value=this.value; sendWorkflowUpdate(this.nextElementSibling)" />`;
        htmlChunk += `<input type="number" class="ic-node-param" data-node-id="${pluginId}" data-param-name="${param.name}" min="${param.min}" max="${param.max}" step="${param.step}" value="${val}" style="width: 55px; text-align: center; font-family: monospace; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px 2px; border-radius: 16px; font-size: 11px; outline: none; box-shadow: none !important; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" oninput="this.previousElementSibling.value=this.value" onchange="sendWorkflowUpdate(this)" />`;
        htmlChunk += `</div>`;
    } else if (param.type === 'string' || param.type === 'password') {
        const inputType = param.type === 'password' ? 'password' : 'text';
        htmlChunk += `<input type="${inputType}" class="ic-node-param" data-node-id="${pluginId}" data-param-name="${param.name}" value="${val}" style="flex: 0 0 260px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 6px 8px; border-radius: 16px; font-size: 11px; outline: none; box-shadow: none !important; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" onchange="sendWorkflowUpdate(this)" />`;
    } else if (param.type === 'enum') {
        htmlChunk += `<select class="ic-node-param ic-select" data-node-id="${pluginId}" data-param-name="${param.name}" style="flex: 1; max-width: 140px; margin-left: 10px; font-size: 11px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px; border-radius: 16px; outline: none; box-shadow: none !important; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" onchange="sendWorkflowUpdate(this)">`;
        param.choices.forEach((c, idx) => {
            const displayChoice = typeof t === 'function' ? t(c) : c;
            const isSelected = (c === val) || (idx === val) || (String(idx) === String(val));
            htmlChunk += `<option value="${c}" ${isSelected ? 'selected' : ''}>${displayChoice}</option>`;
        });
        htmlChunk += `</select>`;
    } else if (param.type === 'randomseed') {
        // Number input (carries .ic-node-param so scraping works) + a "reuse"
        // button (replays the last actually-used seed captured from the
        // generation payload into window.ic_last_used_seed) + a "randomize"
        // button (sets the input to -1, which the backend reads as random).
        htmlChunk += `<div style="display: flex; align-items: center; gap: 6px; flex: 1; justify-content: flex-end; padding-left: 10px;">`;
        htmlChunk += `<input type="number" class="ic-node-param" data-node-id="${pluginId}" data-param-name="${param.name}" value="${val}" style="flex: 1; min-width: 80px; text-align: center; font-family: monospace; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 4px 6px; border-radius: 16px; font-size: 11px; outline: none; box-shadow: none !important; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" onchange="sendWorkflowUpdate(this)" />`;
        // Reuse: only enabled if we have a captured last-used seed.
        // Shared button base — properties marked !important are the ones
        // Gradio's global button rules steal (background/color/border/box-shadow
        // /box-sizing/margin-bottom), learned from the .res-preset-btn case.
        const seedBtnStyle = "flex-shrink: 0; height: 28px; min-width: 28px; padding: 0 8px; border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)) !important; border-radius: 8px !important; background: var(--background-fill-secondary, rgba(128,128,128,0.15)) !important; color: var(--body-text-color, #fff) !important; cursor: pointer !important; font-size: 13px; line-height: 1; box-sizing: border-box !important; margin: 0 !important; margin-bottom: 0 !important; box-shadow: none !important; font-family: sans-serif;";
        htmlChunk += `<button type="button" title="${typeof t === 'function' ? t('Reuse last seed') : 'Reuse last seed'}" style="${seedBtnStyle}" onclick="(function(b){var inp=b.previousElementSibling;var s=window.ic_last_used_seed;if(s===undefined||s===null){return;}inp.value=s;inp.dispatchEvent(new Event('change',{bubbles:true}));})(this)">↻</button>`;
        // Randomize: set to -1.
        htmlChunk += `<button type="button" title="${typeof t === 'function' ? t('Randomize (-1)') : 'Randomize (-1)'}" style="${seedBtnStyle}" onclick="(function(b){var inp=b.previousElementSibling.previousElementSibling;inp.value=-1;inp.dispatchEvent(new Event('change',{bubbles:true}));})(this)">🎲</button>`;
        htmlChunk += `</div>`;
    }

    htmlChunk += `</div>`;
    return htmlChunk;
}

// is_generation_param is treated as True when omitted (back-compat with any
// param dict that doesn't tag itself). Only an explicit `false` marks a param
// as a persistent setting.
function isGenParam(param) {
    return param.is_generation_param !== false;
}

function updateWorkflowUI(data, container) {
    if (!data || !data.registry) return;

    const stepParams = data.step_params || {};
    const registry = data.registry || [];

    // ---- 1. Pipeline node strip (overlay list column only) ----
    const activeSteps = registry.filter(node => {
        if (!node.is_plugin) return true;
        const pValues = stepParams[node.id] || {};
        return pValues.enabled === true;
    });
    activeSteps.sort((a, b) => a.sort_index - b.sort_index);

    let availableTypes = new Set(['SdStyleInput']);
    let typeErrorStepIndex = -1;
    let typeErrorReason = "";

    for (let i = 0; i < activeSteps.length; i++) {
        const step = activeSteps[i];
        const sig = step.type_signature || { in: [], out: [] };
        const ins = sig.in || [];
        
        for (let j = 0; j < ins.length; j++) {
            if (!availableTypes.has(ins[j])) {
                typeErrorStepIndex = i;
                typeErrorReason = `Requires input '${ins[j]}', but it is not provided by any upstream step.`;
                break;
            }
        }
        if (typeErrorStepIndex !== -1) break;
        const outs = sig.out || [];
        outs.forEach(t => availableTypes.add(t));
    }

    if (typeErrorStepIndex === -1 && !availableTypes.has('FinalOutputImage')) {
        if (activeSteps.length > 0) {
            typeErrorStepIndex = activeSteps.length - 1;
            typeErrorReason = "Pipeline does not output 'FinalOutputImage' at the end.";
        }
    }

    let activeStepCounter = 0;
    let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
    registry.forEach(node => {
        const hue = node.sort_index % 360;
        let isActive = !node.is_plugin;
        if (node.is_plugin) {
            const pValues = stepParams[node.id] || {};
            if (pValues.enabled) isActive = true;
        }

        if (isActive) {
            let hasError = false;
            let errorText = "";
            if (typeErrorStepIndex !== -1 && activeStepCounter >= typeErrorStepIndex) {
                hasError = true;
                errorText = typeErrorReason;
            }
            html += createNodeHtml(t(node.name), hue, hasError, errorText);
            activeStepCounter++;
        }
    });
    html += `</div>`;

    // ---- 2. Overlay settings column: is_generation_param==False params ----
    // (includes `enabled`, which toggles the plugin on/off via a checkbox).
    let settingsHtml = `<div style="padding-top: 55px;">`;
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

        // Render only the setting params (excluding `enabled`, which is the
        // header checkbox above). Pure-toggle plugins render an empty body
        // here — that's fine; their only control is the enabled checkbox.
        let settingsBody = '';
        plugin.params.forEach(param => {
            if (param.name === 'enabled') return;
            if (isGenParam(param)) return; // generation params go to the sidebar
            const val = pValues[param.name] !== undefined ? pValues[param.name] : param.default;
            settingsBody += renderParamRow(plugin.id, param, val);
        });

        if (settingsBody) {
            settingsHtml += `<div class="ic_plugin_params_${plugin.id}" style="transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; overflow: hidden; max-height: ${isPluginEnabled ? '1000px' : '0px'}; opacity: ${isPluginEnabled ? '1' : '0'};">`;
            settingsHtml += settingsBody;
            settingsHtml += `</div>`;
        }
        settingsHtml += `</div></div>`;
    });
    settingsHtml += `</div>`;

    // ---- 3. Sidebar: collapsible cards of generation params for ENABLED plugins ----
    // Pure-toggle plugins (only `enabled`, no gen params) are NOT shown here.
    // ParseInputStep is a CORE step (is_plugin=false) but carries the generation
    // scalars (prompt/steps/cfg/...) as its params, so it's allowed through.
    let sidebarHtml = '';
    registry.forEach(plugin => {
        if (!plugin.is_plugin && plugin.id !== 'parse_input') return;
        const pValues = stepParams[plugin.id] || {};
        const enabledParam = plugin.params.find(p => p.name === 'enabled');
        const isPluginEnabled = enabledParam
            ? (pValues['enabled'] !== undefined ? pValues['enabled'] : enabledParam.default)
            : true;
        if (!isPluginEnabled) return;

        // Collect generation params
        let genBody = '';
        plugin.params.forEach(param => {
            if (param.name === 'enabled') return;
            if (!isGenParam(param)) return;
            const val = pValues[param.name] !== undefined ? pValues[param.name] : param.default;
            genBody += renderParamRow(plugin.id, param, val);
        });
        if (!genBody) return; // pure-toggle plugin → skip sidebar

        const hue = plugin.sort_index % 360;
        sidebarHtml += `<div class="ic-sidebar-plugin-card" style="--node-hue: ${hue};">`;
        // Header: click toggles collapse (NOT enabled). Chevron rotates.
        sidebarHtml += `<div class="ic-sidebar-plugin-header" onclick="(function(h){const b=h.nextElementSibling;const c=h.querySelector('.ic-sidebar-plugin-chevron');const open=b.style.maxHeight!=='0px';b.style.maxHeight=open?'0px':'1000px';b.style.opacity=open?'0':'1';c.style.transform=open?'rotate(-90deg)':'rotate(0deg)';})(this)">`;
        sidebarHtml += `<span>${t(plugin.name)}</span>`;
        sidebarHtml += `<svg class="ic-sidebar-plugin-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(0deg);"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        sidebarHtml += `</div>`;
        // Body (expanded by default)
        sidebarHtml += `<div class="ic-sidebar-plugin-body" style="max-height: 1000px; opacity: 1; padding-top: 8px;">`;
        sidebarHtml += genBody;
        sidebarHtml += `</div>`;
        sidebarHtml += `</div>`;
    });

    // Sidebar gets ONLY the generation-param cards (no node strip).
    container.innerHTML = sidebarHtml;

    // Overlay columns get the node strip + settings cards.
    const overlayList = document.getElementById('ic-nodes-list-col');
    const overlaySettings = document.getElementById('ic-nodes-settings-col');
    if (overlayList) overlayList.innerHTML = html;
    if (overlaySettings) overlaySettings.innerHTML = settingsHtml;

    // Size every 'text' textarea to its content now that it's in the DOM.
    // (The oninput auto-size only fires on user input, not initial render.)
    const _autosize = (root) => {
        if (!root) return;
        root.querySelectorAll('textarea.ic-node-param').forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = Math.max(32, ta.scrollHeight) + 'px';
        });
    };
    _autosize(container);
    _autosize(overlaySettings);

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
    // Scrape BOTH views: the sidebar (generation params) AND the overlay
    // settings column (settings + enabled). The two views render disjoint
    // param sets, so merging them here yields the complete stepParams.
    // (Previously this only scraped the sidebar, which silently dropped any
    // settings param like API keys — now fixed.)
    const sidebar = document.getElementById('ic_workflow_html');
    const settingsCol = document.getElementById('ic-nodes-settings-col');
    const inputs = [
        ...(sidebar ? Array.from(sidebar.querySelectorAll('.ic-node-param')) : []),
        ...(settingsCol ? Array.from(settingsCol.querySelectorAll('.ic-node-param')) : [])
    ];

    inputs.forEach(input => {
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

    // Send the update to the backend directly via fetch
    fetch('/infinite-canvas-api/workflow/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload_json: JSON.stringify({ step_params: stepParams }) })
    }).then(res => res.json())
      .then(data => {
          if (window.ic_handle_workflow_output) window.ic_handle_workflow_output(data);
      })
      .catch(e => console.error("Workflow update failed", e));
}

function createNodeHtml(text, hue, hasError = false, errorText = "") {
    let errorHtml = "";
    if (hasError) {
        // Escape single quotes for the onclick alert
        const safeError = errorText.replace(/'/g, "\\'");
        errorHtml = `
            <div title="${errorText}" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); width:16px; height:16px; background-color:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="alert('${safeError}')">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </div>
        `;
    }
    return `<div class="ic-pipeline-node fluent-card" style="--node-hue: ${hue}; position:relative; padding-right: ${hasError ? '28px' : '12px'};">
        <div class="fluent-content">${text}</div>
        ${errorHtml}
    </div>`;
}
