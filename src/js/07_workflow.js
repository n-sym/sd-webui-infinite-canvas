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

    @keyframes icSelectPopupMorph {
        0% { transform: scale(0.98) translateY(-4px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    .ic-custom-options-teleported {
        animation: icSelectPopupMorph 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        transform-origin: top center;
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
        --ic-border-color: hsla(var(--node-hue), 45%, 55%, 0.5);
        --ic-glow-color: hsla(var(--node-hue), 60%, 65%, 0.6);
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .dark .ic-sidebar-plugin-card {
        border-color: hsla(var(--node-hue), 45%, 45%, 0.5);
        --ic-border-color: hsla(var(--node-hue), 45%, 45%, 0.5);
        --ic-glow-color: hsla(var(--node-hue), 60%, 55%, 0.6);
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
        padding: 6px 8px;
        margin: -6px -8px;
        border-radius: 8px;
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
        
        const uniqueClass = `ic-prompt-wrap-${pluginId}-${param.name}`;
        
        // Use explicitly named fonts because some Chromium versions resolve "system-ui" differently for textareas vs divs (e.g. Segoe UI vs Arial), causing horizontal per-character width drift.
        const sharedTypography = "font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; letter-spacing: 0.05em; word-spacing: 0px; text-transform: none; text-indent: 0px; text-shadow: none; font-weight: 400; font-variant-ligatures: none; font-kerning: none; -webkit-text-size-adjust: 100%; tab-size: 4;";
        
        return `
        <div style="margin-bottom: 8px;" ${param.tooltip ? `title="${typeof t === 'function' ? t(param.tooltip) : param.tooltip}"` : ''}>
            <div style="margin-bottom: 4px; font-size: 13px; color: var(--body-text-color, #ccc);">${typeof t === 'function' ? t(param.label) : param.label}</div>
            <div class="${uniqueClass}" style="position: relative; width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); border-radius: 12px; transition: border-color 0.2s; overflow: hidden; min-height: 32px;">
                <div class="ic-syntax-overlay notranslate" translate="no" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 6px 8px; box-sizing: border-box; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; color: var(--body-text-color, #fff); pointer-events: none; overflow: hidden; margin: 0; ${sharedTypography}"></div>
                <textarea class="ic-node-param" data-node-id="${pluginId}" data-param-name="${param.name}" rows="2" style="position: relative; z-index: 1; width: 100%; box-sizing: border-box; resize: none; min-height: 32px; overflow: hidden; background: transparent; border: none; color: transparent; caret-color: var(--body-text-color, #fff); padding: 6px 8px; outline: none; box-shadow: none !important; margin: 0; display: block; ${sharedTypography}"
                onfocus="this.parentElement.style.borderColor='var(--color-accent, cornflowerblue)'; if(window.ic_update_syntax) window.ic_update_syntax(this);" 
                onblur="this.parentElement.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))'; if(window.ic_update_syntax) window.ic_update_syntax(this);" 
                oninput="this.style.height='auto';this.style.height=Math.max(32,this.scrollHeight)+'px'; if(window.ic_update_syntax) window.ic_update_syntax(this);" 
                onscroll="this.previousElementSibling.scrollTop = this.scrollTop;"
                onclick="if(window.ic_update_syntax) window.ic_update_syntax(this);"
                onkeyup="if(window.ic_update_syntax) window.ic_update_syntax(this);"
                onchange="sendWorkflowUpdate(this)">${escaped}</textarea>
            </div>
        </div>`;
    }

    const tooltipAttr = param.tooltip ? ` title="${typeof t === 'function' ? t(param.tooltip) : param.tooltip}"` : '';
    let htmlChunk = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: var(--body-text-color, #ccc);"${tooltipAttr}>`;
    htmlChunk += `<span style="flex-shrink: 0; margin-right: 15px;">${typeof t === 'function' ? t(param.label) : param.label}</span>`;

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
        const uniqueId = `ic-custom-select-${pluginId}-${param.name}`.replace(/[^a-zA-Z0-9-]/g, '-');
        
        // 1. The hidden actual select
        htmlChunk += `<select id="${uniqueId}-native" class="ic-node-param" data-node-id="${pluginId}" data-param-name="${param.name}" style="display: none;">`;
        let selectedChoice = param.choices[0];
        param.choices.forEach((c, idx) => {
            const isSelected = (c === val) || (idx === val) || (String(idx) === String(val));
            if (isSelected) selectedChoice = c;
            htmlChunk += `<option value="${c}" ${isSelected ? 'selected' : ''}>${c}</option>`;
        });
        htmlChunk += `</select>`;

        const selectedChoiceStr = typeof t === 'function' ? t(selectedChoice) : selectedChoice;

        // 2. The custom UI
        htmlChunk += `
        <div id="${uniqueId}-wrapper" class="ic-custom-select-wrapper" style="position: relative; flex: 1; max-width: 140px; margin-left: 10px; outline: none;" tabindex="0" onblur="
            setTimeout(() => {
                const opts = document.getElementById('${uniqueId}-opts');
                if(opts) opts.remove();
                const disp = this.querySelector('.ic-custom-select-display');
                if(disp) disp.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';
            }, 150);
        ">
            <div class="ic-custom-select-display" onclick="
                this.parentElement.focus();
                let existing = document.getElementById('${uniqueId}-opts');
                if(existing) {
                    existing.remove();
                    this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';
                    return;
                }
                document.querySelectorAll('.ic-custom-options-teleported').forEach(el => el.remove());
                const tpl = this.nextElementSibling;
                const opts = tpl.content.cloneNode(true).firstElementChild;
                opts.id = '${uniqueId}-opts';
                const rect = this.getBoundingClientRect();
                opts.style.position = 'fixed';
                opts.style.top = (rect.top - 4) + 'px';
                opts.style.left = (rect.left - 4) + 'px';
                opts.style.width = (rect.width + 8) + 'px';
                opts.style.zIndex = '999999';
                opts.style.fontFamily = window.getComputedStyle(this).fontFamily;
                document.body.appendChild(opts);
                this.style.borderColor='var(--color-accent, cornflowerblue)';
            " style="box-sizing: border-box; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 5px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: border-color 0.2s; user-select: none;">
                <span class="ic-custom-selected-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px;">${selectedChoiceStr}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6; flex-shrink: 0;"><path d="M6 9l6 6 6-6"></path></svg>
            </div>
            <template class="ic-custom-options-tpl">
                <div class="ic-custom-options-teleported" style="box-sizing: border-box; background: var(--background-fill-primary, #1e293b); border: 1px solid transparent; border-radius: 12px; overflow-y: auto; max-height: 220px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); padding: 4px; display: flex; flex-direction: column; gap: 2px;">`;
        
        param.choices.forEach((c, idx) => {
            const isSelected = (c === val) || (idx === val) || (String(idx) === String(val));
            const disp = typeof t === 'function' ? t(c) : c;
            const pillHtml = isSelected ? `<div style="position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 14px; background-color: var(--color-accent, cornflowerblue); border-radius: 4px;"></div>` : ``;
            const bg = isSelected ? `rgba(255,255,255,0.08)` : `transparent`;
            
            htmlChunk += `<div class="ic-custom-option" data-val="${c.replace(/"/g, '&quot;')}" onclick="
                const nativeSelect = document.getElementById('${uniqueId}-native');
                const wrap = document.getElementById('${uniqueId}-wrapper');
                if(wrap) wrap.querySelector('.ic-custom-selected-text').innerText = this.querySelector('span').innerText;
                if(nativeSelect) {
                    nativeSelect.value = this.dataset.val;
                    sendWorkflowUpdate(nativeSelect);
                }
                this.parentElement.remove();
                if(wrap) wrap.querySelector('.ic-custom-select-display').style.borderColor = 'var(--border-color-primary, rgba(128,128,128,0.2))';
            " style="position: relative; box-sizing: border-box; padding: 5px 10px; font-size: 11px; color: var(--body-text-color, #f1f5f9); cursor: pointer; transition: background 0.15s; display: flex; justify-content: flex-start; align-items: center; user-select: none; border-radius: 8px; background: ${bg};" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='${bg}'">
                ${pillHtml}
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${disp}</span>
            </div>`;
        });
        
        htmlChunk += `</div></template></div>`;
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

async function updateWorkflowUI(data, container) {
    if (!data || !data.registry) return;

    const stepParams = data.step_params || {};
    window.ic_current_step_params = JSON.parse(JSON.stringify(stepParams));
    const registry = data.registry || [];

    // Make API call for validation
    let failed_step_id = null;
    let error_reason = "";
    
    try {
        const payload = JSON.stringify({
            step_params: stepParams
        });
        const res = await fetch('/infinite-canvas-api/canvas/validate_workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload_json: payload })
        });
        const validation = await res.json();
        if (validation && !validation.valid) {
            failed_step_id = validation.failed_step_id;
            error_reason = validation.error_reason;
        }
    } catch (e) {
        console.error("Workflow validation failed:", e);
    }

    // ---- 1. Pipeline node strip (overlay list column only) ----
    const activeSteps = registry.filter(node => {
        if (!node.is_plugin) return true;
        const pValues = stepParams[node.id] || {};
        return pValues.enabled === true;
    });
    activeSteps.sort((a, b) => a.sort_index - b.sort_index);

    let hasErrorYet = false;

    let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
    registry.forEach(node => {
        const hue = node.sort_index % 360;
        let isActive = !node.is_plugin;
        if (node.is_plugin) {
            const pValues = stepParams[node.id] || {};
            if (pValues.enabled) isActive = true;
        }

        if (isActive) {
            if (node.id === failed_step_id) {
                hasErrorYet = true;
            }
            let hasError = hasErrorYet;
            let errorText = hasError ? error_reason : "";
            html += createNodeHtml(t(node.name), hue, hasError, errorText, node.type_signature);
        }
    });
    html += `</div>`;

    // ---- 2. Overlay settings column: is_generation_param==False params ----
    // (includes `enabled`, which toggles the plugin on/off via a checkbox).
    let settingsHtml = `<div style="padding-top: 55px;">`;
    registry.forEach(plugin => {
        if (!plugin.is_plugin) return;

        const hue = plugin.sort_index % 360;
        settingsHtml += `<div class="ic-plugin-setting-group ic-sidebar-plugin-card fluent-card" style="--node-hue: ${hue}; cursor: pointer; display: block;" onclick="if(event.target.closest('input') || event.target.closest('select') || event.target.closest('.ic_plugin_params_${plugin.id}')) return; const cb = this.querySelector('input[data-param-name=\\'enabled\\']'); if(cb) cb.click();">`;
        const pValues = stepParams[plugin.id] || {};

        let isPluginEnabled = true;
        const enabledParam = plugin.params.find(p => p.name === 'enabled');
        if (enabledParam) {
            isPluginEnabled = pValues['enabled'] !== undefined ? pValues['enabled'] : enabledParam.default;
        }

        settingsHtml += `<div class="ic-sidebar-plugin-header">`;
        settingsHtml += `<span>${t(plugin.name)}</span>`;
        if (enabledParam) {
            settingsHtml += `<input type="checkbox" class="ic-node-param" data-node-id="${plugin.id}" data-param-name="enabled" ${isPluginEnabled ? 'checked' : ''} style="cursor: pointer;" onchange="const wraps = document.querySelectorAll('.ic_plugin_params_${plugin.id}'); wraps.forEach(w => { w.style.gridTemplateRows = this.checked ? '1fr' : '0fr'; w.style.opacity = this.checked ? '1' : '0'; }); setTimeout(() => sendWorkflowUpdate(this), 300);" />`;
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
            settingsHtml += `<div class="ic_plugin_params_${plugin.id}" style="display: grid; transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; grid-template-rows: ${isPluginEnabled ? '1fr' : '0fr'}; opacity: ${isPluginEnabled ? '1' : '0'};">`;
            settingsHtml += `<div style="min-height: 0; overflow: hidden;">`;
            settingsHtml += `<div style="padding-top: 8px;">`;
            settingsHtml += settingsBody;
            settingsHtml += `</div></div></div>`;
        } else {
            // Pure toggle plugins need an empty div to balance the negative margin on the header
            settingsHtml += `<div></div>`;
        }
        settingsHtml += `</div>`;
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

        window.ic_sidebar_collapse_state = window.ic_sidebar_collapse_state || {};
        const isCardOpen = window.ic_sidebar_collapse_state[plugin.id] !== false; // default true
        const gridRows = isCardOpen ? '1fr' : '0fr';
        const gridOpacity = isCardOpen ? '1' : '0';
        const chevronRot = isCardOpen ? '0deg' : '-90deg';

        const hue = plugin.sort_index % 360;
        sidebarHtml += `<div class="ic-sidebar-plugin-card fluent-card" style="--node-hue: ${hue}; cursor: pointer;" onclick="if(event.target.closest('.ic-sidebar-plugin-wrap')) return; (function(c){const w=c.querySelector('.ic-sidebar-plugin-wrap');const ch=c.querySelector('.ic-sidebar-plugin-chevron');const open=w.style.gridTemplateRows!=='0fr';w.style.gridTemplateRows=open?'0fr':'1fr';w.style.opacity=open?'0':'1';ch.style.transform=open?'rotate(-90deg)':'rotate(0deg)'; window.ic_sidebar_collapse_state['${plugin.id}'] = !open;})(this)">`;
        // Header: click toggles collapse (NOT enabled). Chevron rotates.
        sidebarHtml += `<div class="ic-sidebar-plugin-header">`;
        sidebarHtml += `<span>${t(plugin.name)}</span>`;
        sidebarHtml += `<svg class="ic-sidebar-plugin-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${chevronRot});"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
        sidebarHtml += `</div>`;
        // Body
        sidebarHtml += `<div class="ic-sidebar-plugin-wrap" style="display: grid; grid-template-rows: ${gridRows}; transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; opacity: ${gridOpacity};">`;
        sidebarHtml += `<div style="min-height: 0; overflow: hidden;">`;
        sidebarHtml += `<div class="ic-sidebar-plugin-body" style="padding-top: 8px;">`;
        sidebarHtml += genBody;
        sidebarHtml += `</div></div></div>`;
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
            ta.style.height = Math.max(32, ta.scrollHeight + 2) + 'px';
            if (window.ic_update_syntax) window.ic_update_syntax(ta);
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

    const stepParams = window.ic_current_step_params ? JSON.parse(JSON.stringify(window.ic_current_step_params)) : {};
    // Scrape BOTH views: the sidebar (generation params) AND the overlay
    // settings column (settings + enabled). The two views render disjoint
    // param sets, so merging them here yields the complete updated stepParams.
    // Unrendered elements (like generation params of disabled plugins) are preserved because we initialized from ic_current_step_params.
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

function formatType(tObj) {
    if (!tObj) return "Unknown";
    if (typeof tObj === 'string') return tObj;
    if (tObj.mapping) return `${formatType(tObj.source)} ➔ ${formatType(tObj.target)}`;
    let base = tObj.type || "Unknown";
    if (tObj.params && tObj.params.length > 0) {
        return `${base}[${tObj.params.map(p => typeof p === 'object' ? formatType(p) : p).join(', ')}]`;
    }
    return base;
}

function createNodeHtml(text, hue, hasError = false, errorText = "", typeSig = null) {
    let errorHtml = "";
    if (hasError) {
        // Escape single quotes for the onclick alert
        const safeError = errorText.replace(/'/g, "\\'");
        errorHtml = `
            <div title="${errorText}" style="position:absolute; right:8px; top:12px; width:16px; height:16px; background-color:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="alert('${safeError}'); event.stopPropagation();">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </div>
        `;
    }

    let typeHtml = "";
    if (typeSig) {
        const renderBadge = (t) => `<span style="display:inline-block; padding: 2px 4px; background: rgba(0,0,0,0.2); border-radius: 4px; margin: 2px; color: #223751;">${formatType(t)}</span>`;
        let ins = (typeSig.in || []).map(renderBadge).join('');
        let outs = (typeSig.out || []).map(renderBadge).join('');
        
        typeHtml = `
            <div class="ic-node-types-container" style="display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;">
                <div style="min-height: 0; overflow: hidden;">
                    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                        ${ins ? `<div style="margin-bottom: 4px; color: #292e35;"><strong style="font-weight: 600;">IN:</strong> ${ins}</div>` : ''}
                        ${outs ? `<div style="color: #292e35;"><strong style="font-weight: 600;">OUT:</strong> ${outs}</div>` : ''}
                        ${(!ins && !outs) ? `<div style="color: #64748b; font-style: italic;">No type signature</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    return `<div class="ic-pipeline-node fluent-card" style="--node-hue: ${hue}; position:relative; padding-right: ${hasError ? '28px' : '12px'}; cursor: pointer;" onclick="(function(c){const t = c.querySelector('.ic-node-types-container'); if(t){const open=t.style.gridTemplateRows!=='0fr';t.style.gridTemplateRows=open?'0fr':'1fr';t.style.opacity=open?'0':'1';}})(this)">
        <div class="fluent-content">${text}</div>
        ${typeHtml}
        ${errorHtml}
    </div>`;
}

if (!window.ic_custom_select_scroll_listener_added) {
    window.ic_custom_select_scroll_listener_added = true;
    const closeDropdowns = (e) => {
        if (e.target.closest('.ic-custom-options-teleported')) return;
        document.querySelectorAll('.ic-custom-options-teleported').forEach(el => el.remove());
        document.querySelectorAll('.ic-custom-select-display').forEach(disp => {
            disp.style.borderColor = 'var(--border-color-primary, rgba(128,128,128,0.2))';
        });
    };
    window.addEventListener('wheel', closeDropdowns, { passive: true, capture: true });
    window.addEventListener('scroll', closeDropdowns, { passive: true, capture: true });
}

// Prompt Syntax Highlighting & Bracket Matching Engine
window.ic_update_syntax = function(textarea) {
    const overlay = textarea.previousElementSibling;
    if (!overlay || !overlay.classList.contains('ic-syntax-overlay')) return;
    
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    
    // Low saturation Tag Cloud colors
    const TAG_COLORS = [
        'color-mix(in srgb, #ef4444 35%, var(--body-text-color, #fff))',
        'color-mix(in srgb, #f97316 35%, var(--body-text-color, #fff))',
        'color-mix(in srgb, #eab308 35%, var(--body-text-color, #fff))',
        'color-mix(in srgb, #22c55e 35%, var(--body-text-color, #fff))',
        'color-mix(in srgb, #0ea5e9 35%, var(--body-text-color, #fff))',
        'color-mix(in srgb, #8b5cf6 35%, var(--body-text-color, #fff))',
        'color-mix(in srgb, #ec4899 35%, var(--body-text-color, #fff))'
    ];
    
    // 1. Bracket Matching Map
    const pairMap = new Map();
    const openStack = [];
    for(let i=0; i<text.length; i++) {
        const c = text[i];
        if (c === '(' || c === '[' || c === '{') {
            openStack.push({char: c, index: i});
        } else if (c === ')' || c === ']' || c === '}') {
            const expectedOpen = (c === ')') ? '(' : (c === ']') ? '[' : '{';
            let matchIdx = -1;
            for(let j=openStack.length-1; j>=0; j--) {
                if(openStack[j].char === expectedOpen) {
                    matchIdx = j;
                    break;
                }
            }
            if (matchIdx !== -1) {
                const openNode = openStack.splice(matchIdx, 1)[0];
                pairMap.set(openNode.index, i);
                pairMap.set(i, openNode.index);
            }
        }
    }
    
    let activeB1 = -1, activeB2 = -1;
    // Check cursor adjacency. If typing immediately after a bracket, or clicking right before it.
    if (cursorPos > 0 && pairMap.has(cursorPos - 1)) {
        activeB1 = cursorPos - 1; activeB2 = pairMap.get(activeB1);
    } else if (cursorPos < text.length && pairMap.has(cursorPos)) {
        activeB1 = cursorPos; activeB2 = pairMap.get(activeB1);
    }

    // 2. LoRA / Embeddings regex pre-parse
    const loras = [];
    const loraRegex = /<(lora|lyco):[^>]+>/g;
    let match;
    while ((match = loraRegex.exec(text)) !== null) {
        loras.push({start: match.index, end: loraRegex.lastIndex});
    }
    
    let html = '';
    let tagIdx = 0;
    
    let currentStyle = '';
    let buffer = '';
    
    const flush = () => {
        if (!buffer) return;
        const escaped = buffer.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        if (currentStyle) {
            html += `<span style="${currentStyle}">${escaped}</span>`;
        } else {
            html += escaped;
        }
        buffer = '';
    };

    // 3. Chunk-based span generation
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const isLora = loras.some(l => i >= l.start && i < l.end);
        
        let newStyle = `color: ${TAG_COLORS[tagIdx % TAG_COLORS.length]};`;
        
        if (isLora) {
            newStyle = `color: var(--color-accent, cornflowerblue);`;
        } else if (c === '(' || c === ')' || c === '[' || c === ']' || c === '{' || c === '}') {
            if (i === activeB1 || i === activeB2) {
                newStyle = `color: var(--body-text-color, #fff); background-color: color-mix(in srgb, var(--color-accent, cornflowerblue) 50%, transparent); border-radius: 2px;`;
            } else {
                newStyle = `color: color-mix(in srgb, var(--body-text-color, #fff) 60%, transparent);`;
            }
        } else if (c === ',') {
            newStyle = `color: color-mix(in srgb, var(--body-text-color, #fff) 40%, transparent);`;
        } else if (c === ':') {
            newStyle = `color: color-mix(in srgb, var(--body-text-color, #fff) 60%, transparent);`;
        }
        
        if (newStyle !== currentStyle) {
            flush();
            currentStyle = newStyle;
        }
        buffer += c;
        
        if (c === ',') tagIdx++;
    }
    flush();
    
    // WebKit textareas add an invisible trailing newline space if ending in newline
    if (text.endsWith('\\n')) html += '<br/>';
    
    overlay.innerHTML = html;
};