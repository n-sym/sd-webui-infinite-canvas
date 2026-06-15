let ic_ui_initInterval = setInterval(() => {
    const container = document.getElementById('ic-container');
    if (container) {
        clearInterval(ic_ui_initInterval);
        initICSidebar();
    }
}, 500);

// Hide scrollbars on the sidebar's inner scroll region (#ic_workflow_html)
// while keeping it scrollable. Injected once. Both the standard property
// (Firefox) and the ::-webkit-scrollbar pseudo (Chrome/Edge) are covered.
if (!document.getElementById('ic-sidebar-scroll-style')) {
    const s = document.createElement('style');
    s.id = 'ic-sidebar-scroll-style';
    s.textContent = `
        #ic_workflow_html { scrollbar-width: none; -ms-overflow-style: none; }
        #ic_workflow_html::-webkit-scrollbar { display: none; width: 0; height: 0; }
    `;
    document.head.appendChild(s);
}

function initICSidebar() {
    const container = document.getElementById('ic-container');
    if (!container) return;

    // The generation parameters (prompt/steps/cfg/sampler/seed/...) are now
    // declared by ParseInputStep and rendered as collapsible cards inside
    // #ic_workflow_html by 07_workflow.js. This sidebar is the shell.
    //
    // The sidebar itself has two states:
    //   - COLLAPSED (default): shows only a dedicated prompt textarea. Compact.
    //   - EXPANDED: shows the full #ic_workflow_html (all params + plugins),
    //     width grows to 550px. No internal scrollbar — content sized to fit.
    //
    // The collapsed prompt mirrors the expanded one because both carry
    // class="ic-node-param" data-param-name="prompt" data-node-id="parse_input",
    // and sendWorkflowUpdate already mirrors values across matching inputs.
    const sidebarHTML = `
    <div id="ic-sidebar" class="fluent-panel" data-ic-state="collapsed" style="
        position: absolute;
        top: 20px;
        right: 20px;
        width: 340px;
        background: color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 14px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), inset 1px 1px 0 rgba(255,255,255,0.2);
        z-index: 1000;
        pointer-events: auto;
        color: var(--body-text-color, #fff);
        font-family: sans-serif;
        cursor: default;
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-shrink: 0;">
            <h3 id="ic-sidebar-title" style="margin: 0; font-size: 15px; font-weight: 700;">${typeof t === 'function' ? t('Generation Parameters') : 'Generation Parameters'}</h3>
            <button id="ic-sidebar-toggle" type="button" title="${typeof t === 'function' ? t('Expand') : 'Expand'}" style="flex-shrink: 0; width: 28px; height: 28px; padding: 0; border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)) !important; border-radius: 8px !important; background: var(--background-fill-secondary, rgba(128,128,128,0.15)) !important; color: var(--body-text-color, #fff) !important; cursor: pointer !important; box-sizing: border-box !important; margin: 0 !important; margin-bottom: 0 !important; box-shadow: none !important; display: flex; align-items: center; justify-content: center;">
                <svg id="ic-sidebar-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: all 0.3s ease;">
                    <rect id="ic-sidebar-icon-large" x="5" y="5" width="14" height="14" rx="2" style="transition: all 0.3s ease; stroke-dasharray: 2 4; opacity: 0.5;"></rect>
                    <rect id="ic-sidebar-icon-small" x="12" y="5" width="7" height="7" rx="1" style="transition: all 0.3s ease; stroke-dasharray: none; opacity: 1;"></rect>
                </svg>
            </button>
        </div>

        <!-- Collapsed: dedicated prompt-only textarea. Intentionally NOT a
             .ic-node-param — it's a UI affordance only. Its onchange calls
             sendWorkflowUpdate(this), which mirrors the value into the
             authoritative prompt textarea inside #ic_workflow_html (found via
             data-node-id/data-param-name). That way the expanded prompt stays
             the single source of truth for scraping. -->
        <textarea id="ic-sidebar-prompt" data-node-id="parse_input" data-param-name="prompt" rows="2" placeholder="${typeof t === 'function' ? t('提示词') : '提示词'}" style="width: 100%; box-sizing: border-box; resize: none; min-height: 32px; overflow: hidden; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); color: var(--body-text-color, #fff); padding: 6px 8px; border-radius: 12px; font-size: 12px; font-family: sans-serif; outline: none; box-shadow: none !important; transition: border-color 0.2s, max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease; line-height: 1.4; flex-shrink: 0;" onfocus="this.style.borderColor='var(--color-accent, cornflowerblue)';" onblur="this.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" oninput="this.style.height='auto';this.style.height=Math.max(32,this.scrollHeight)+'px';" onchange="sendWorkflowUpdate(this)"></textarea>

        <!-- Expanded: the full param/plugin cards rendered by 07_workflow.js.
             Uses max-height + opacity transition (NOT display:none↔block) so
             the expand/collapse height change animates cleanly. -->
        <div id="ic_workflow_html" style="flex: 1; overflow-y: auto; max-height: 0; opacity: 0; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;"></div>
    </div>
    `;

    container.insertAdjacentHTML('beforeend', sidebarHTML);

    const sidebar = document.getElementById('ic-sidebar');
    const toggleBtn = document.getElementById('ic-sidebar-toggle');
    const iconLarge = document.getElementById('ic-sidebar-icon-large');
    const iconSmall = document.getElementById('ic-sidebar-icon-small');
    const collapsedPrompt = document.getElementById('ic-sidebar-prompt');
    const workflowHtml = document.getElementById('ic_workflow_html');
    const titleEl = document.getElementById('ic-sidebar-title');

    function setSidebarState(state) {
        const expanded = (state === 'expanded');
        sidebar.setAttribute('data-ic-state', state);
        sidebar.style.width = expanded ? '550px' : '340px';

        // Cap the sidebar's height so it never covers the floating toolbar:
        // available = (toolbar's top) - (sidebar's top: 20px) - gap.
        const toolbar = document.getElementById('ic-floating-toolbar');
        const containerEl = document.getElementById('ic-container');
        let avail = 0;
        if (toolbar && containerEl) {
            const cRect = containerEl.getBoundingClientRect();
            const tRect = toolbar.getBoundingClientRect();
            const toolbarTopInContainer = tRect.top - cRect.top;
            avail = Math.max(120, toolbarTopInContainer - 20 /*sidebar top*/ - 12 /*gap*/);
        } else {
            avail = (containerEl ? containerEl.clientHeight : 800) - 100;
        }
        sidebar.style.maxHeight = avail + 'px';

        // Toggle inner panels. #ic_workflow_html animates via max-height +
        // opacity. The collapsed prompt textarea uses display:none instead —
        // its min-height:32px would otherwise defeat max-height:0 (min-height
        // wins per CSS spec), leaving a 32px sliver visible when expanded.
        if (expanded) {
            // Reserve room for header (~46px) inside the cap.
            const innerMax = Math.max(80, avail - 46);
            workflowHtml.style.maxHeight = innerMax + 'px';
            workflowHtml.style.opacity = '1';
            workflowHtml.style.overflowY = 'auto';
            collapsedPrompt.style.display = 'none';
        } else {
            workflowHtml.style.maxHeight = '0';
            workflowHtml.style.opacity = '0';
            workflowHtml.style.overflowY = 'hidden';
            collapsedPrompt.style.display = 'block';
        }

        if (iconLarge && iconSmall) {
            if (expanded) {
                // Icon represents current state: Expanded (large solid, small dashed)
                iconLarge.style.strokeDasharray = "none";
                iconLarge.style.opacity = "1";
                iconSmall.style.strokeDasharray = "2 4";
                iconSmall.style.opacity = "0.5";
            } else {
                // Icon represents current state: Collapsed (large dashed, small solid)
                iconLarge.style.strokeDasharray = "2 4";
                iconLarge.style.opacity = "0.5";
                iconSmall.style.strokeDasharray = "none";
                iconSmall.style.opacity = "1";
            }
        }
        toggleBtn.title = expanded ? (typeof t === 'function' ? t('Collapse') : 'Collapse') : (typeof t === 'function' ? t('Expand') : 'Expand');
        if (titleEl) titleEl.textContent = (typeof t === 'function' ? t('Generation Parameters') : 'Generation Parameters');

        if (expanded) {
            // Re-autosize textareas now that #ic_workflow_html is visible.
            workflowHtml.querySelectorAll('textarea.ic-node-param').forEach(ta => {
                ta.style.height = 'auto';
                ta.style.height = Math.max(32, ta.scrollHeight) + 'px';
            });
        } else {
            // Mirror current prompt value into the collapsed textarea.
            const expandedPrompt = workflowHtml.querySelector('.ic-node-param[data-node-id="parse_input"][data-param-name="prompt"]');
            if (expandedPrompt && expandedPrompt.value !== collapsedPrompt.value) {
                collapsedPrompt.value = expandedPrompt.value;
            }
            collapsedPrompt.style.height = 'auto';
            collapsedPrompt.style.height = Math.max(32, collapsedPrompt.scrollHeight) + 'px';
        }
    }

    toggleBtn.addEventListener('click', () => {
        const cur = sidebar.getAttribute('data-ic-state') || 'collapsed';
        setSidebarState(cur === 'expanded' ? 'collapsed' : 'expanded');
    });

    // When 07_workflow.js (re)renders #ic_workflow_html, keep the collapsed
    // prompt in sync and re-autosize if currently expanded.
    const obs = new MutationObserver(() => {
        const expandedPrompt = workflowHtml.querySelector('.ic-node-param[data-node-id="parse_input"][data-param-name="prompt"]');
        if (expandedPrompt && expandedPrompt.value !== collapsedPrompt.value) {
            collapsedPrompt.value = expandedPrompt.value;
        }
        collapsedPrompt.style.height = 'auto';
        collapsedPrompt.style.height = Math.max(32, collapsedPrompt.scrollHeight) + 'px';
        if (sidebar.getAttribute('data-ic-state') === 'expanded') {
            workflowHtml.querySelectorAll('textarea.ic-node-param').forEach(ta => {
                ta.style.height = 'auto';
                ta.style.height = Math.max(32, ta.scrollHeight) + 'px';
            });
        }
    });
    obs.observe(workflowHtml, { childList: true, subtree: true, characterData: true });

    // Initial autosize of the collapsed prompt.
    setTimeout(() => {
        collapsedPrompt.style.height = 'auto';
        collapsedPrompt.style.height = Math.max(32, collapsedPrompt.scrollHeight) + 'px';
    }, 0);

    // Generate / Interrupt buttons live in the floating toolbar (01_state.js).
    // Generate now takes no args — ic_trigger_generate scrapes all params from
    // .ic-node-param (parse_input + plugins) itself.
    const genBtn = document.getElementById('ic-sidebar-generate-btn');
    if (genBtn) {
        genBtn.addEventListener('click', () => {
            if (!window.ic_trigger_generate) return;
            // Prevent double clicking
            if (window.ic_current_task_id) return;
            window.ic_trigger_generate();
        });
    }

    const intBtn = document.getElementById('ic-sidebar-interrupt-btn');
    if (intBtn) {
        intBtn.addEventListener('click', async () => {
            // Show a persistent indeterminate toast while the cancel is in flight.
            // It's dismissed by 08_progress.js when the server pushes a frame with
            // active:false (the job actually stopped), or by the generate finally
            // block if the request returns before the next progress frame.
            if (window.icShowCustomToast) {
                window.icShowCustomToast(
                    (typeof t === 'function' ? t('Submitting cancel...') : 'Submitting cancel...'),
                    0, '0', 'ic-cancel-toast'
                );
            }
            window.icCancelling = true;
            try {
                await fetch('/sdapi/v1/interrupt', { method: 'POST' });
            } catch (e) {
                console.error("Interrupt failed:", e);
                if (typeof icHideToast === 'function') icHideToast('ic-cancel-toast');
                window.icCancelling = false;
            }
        });
    }
}
