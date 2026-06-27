let ic_ui_initInterval = setInterval(() => {
    const container = document.getElementById('ic-container');
    if (container) {
        clearInterval(ic_ui_initInterval);
        initICSidebar();
    }
}, 500);

// Universal JS Custom Scrollbar Logic
if (!window.ic_custom_scrollbar_inited) {
    window.ic_custom_scrollbar_inited = true;
    
    const style = document.createElement('style');
    style.id = 'ic-custom-scrollbar-style';
    style.textContent = `
        .ic-hide-native-scroll {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }
        .ic-hide-native-scroll::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
        }
    `;
    if (document.getElementById('ic-custom-scrollbar-style')) document.getElementById('ic-custom-scrollbar-style').remove();
    document.head.appendChild(style);

    window.ic_init_custom_scrollbar = function(container) {
        if (!container || container.dataset.icHasScrollbar) return;
        container.dataset.icHasScrollbar = 'true';
        
        container.classList.add('ic-hide-native-scroll');
        const cStyle = window.getComputedStyle(container);
        if (cStyle.position === 'static') container.style.position = 'relative';
        
        const thumb = document.createElement('div');
        thumb.className = 'ic-js-scrollbar-thumb';
        thumb.style.position = 'absolute';
        thumb.style.right = '2px';
        thumb.style.width = '6px';
        thumb.style.borderRadius = '3px';
        thumb.style.backgroundColor = 'color-mix(in srgb, var(--body-text-color, #fff) 35%, transparent)';
        thumb.style.zIndex = '999999';
        thumb.style.opacity = '0';
        thumb.style.transition = 'opacity 0.2s, background-color 0.2s';
        thumb.style.pointerEvents = 'auto';
        thumb.style.cursor = 'default';
        container.appendChild(thumb);
        
        let hideTimeout;
        let isDragging = false;
        let startY = 0;
        let startScrollTop = 0;
        
        const updateThumb = () => {
            if (!thumb.parentElement && document.body.contains(container)) {
                container.appendChild(thumb);
            }
            
            const sh = container.scrollHeight;
            const ch = container.clientHeight;
            if (sh <= ch) {
                thumb.style.opacity = '0';
                return;
            }
            
            const thumbHeight = Math.max(30, (ch / sh) * ch);
            thumb.style.height = `${thumbHeight}px`;
            
            const scrollRatio = container.scrollTop / (sh - ch);
            const maxThumbTop = ch - thumbHeight;
            const top = container.scrollTop + (scrollRatio * maxThumbTop);
            
            thumb.style.top = `${top}px`;
            thumb.style.opacity = '1';
            
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                if (!isDragging) thumb.style.opacity = '0';
            }, 800);
        };
        
        container.addEventListener('scroll', updateThumb, { passive: true });
        
        const ro = new ResizeObserver(() => {
            if (thumb.style.opacity === '1' || thumb.style.opacity === '') updateThumb();
        });
        ro.observe(container);
        
        thumb.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startScrollTop = container.scrollTop;
            thumb.style.opacity = '1';
            thumb.style.backgroundColor = 'color-mix(in srgb, var(--body-text-color, #fff) 50%, transparent)';
            clearTimeout(hideTimeout);
            e.preventDefault();
            e.stopPropagation();
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const sh = container.scrollHeight;
            const ch = container.clientHeight;
            const thumbHeight = Math.max(30, (ch / sh) * ch);
            const maxThumbTop = ch - thumbHeight;
            
            const deltaY = e.clientY - startY;
            const scrollDelta = (deltaY / maxThumbTop) * (sh - ch);
            container.scrollTop = startScrollTop + scrollDelta;
        });
        
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                thumb.style.backgroundColor = 'color-mix(in srgb, var(--body-text-color, #fff) 35%, transparent)';
                hideTimeout = setTimeout(() => {
                    thumb.style.opacity = '0';
                }, 800);
            }
        });
        
        setTimeout(updateThumb, 100);
    };

    const initKnownScrollbars = () => {
        ['ic_workflow_html', 'ic-nodes-list-col', 'ic-nodes-settings-col', 'ic-projects-list'].forEach(id => {
            const el = document.getElementById(id);
            if (el) window.ic_init_custom_scrollbar(el);
        });
    };
    
    // Poll for existing static elements until they load
    const initInterval = setInterval(() => {
        initKnownScrollbars();
        if (document.getElementById('ic_workflow_html')) clearInterval(initInterval);
    }, 500);
    
    const obs = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.classList && node.classList.contains('ic-custom-options-teleported')) {
                    window.ic_init_custom_scrollbar(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('.ic-custom-options-teleported').forEach(n => window.ic_init_custom_scrollbar(n));
                }
            });
        });
    });
    obs.observe(document.body, { childList: true, subtree: true });
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
        top: 56px;
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
        <div id="ic-sidebar-prompt-wrap" style="position: relative; width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)); border-radius: 12px; transition: border-color 0.2s, max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease; overflow: hidden; min-height: 32px; flex-shrink: 0; display: block;">
            <div class="ic-syntax-overlay notranslate" translate="no" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; padding: 6px 8px; box-sizing: border-box; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; color: var(--body-text-color, #fff); pointer-events: none; overflow: hidden; margin: 0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; letter-spacing: 0.05em; word-spacing: 0px; text-transform: none; text-indent: 0px; text-shadow: none; font-weight: 400; font-variant-ligatures: none; font-kerning: none; -webkit-text-size-adjust: 100%; tab-size: 4;"></div>
            <textarea id="ic-sidebar-prompt" data-node-id="parse_input" data-param-name="prompt" rows="2" placeholder="${typeof t === 'function' ? t('提示词') : '提示词'}" style="position: relative; z-index: 1; width: 100%; box-sizing: border-box; resize: none; min-height: 32px; overflow-y: auto; overflow-x: hidden; background: transparent; border: none; color: transparent; caret-color: var(--body-text-color, #fff); padding: 6px 8px; outline: none; box-shadow: none !important; margin: 0; display: block; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.5; letter-spacing: 0.05em; word-spacing: 0px; text-transform: none; text-indent: 0px; text-shadow: none; font-weight: 400; font-variant-ligatures: none; font-kerning: none; -webkit-text-size-adjust: 100%; tab-size: 4;" onfocus="this.parentElement.style.borderColor='var(--color-accent, cornflowerblue)'; if(window.ic_update_syntax) window.ic_update_syntax(this);" onblur="this.parentElement.style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))'; if(window.ic_update_syntax) window.ic_update_syntax(this);" oninput="this.style.height='auto';this.style.height=Math.max(32,this.scrollHeight)+'px'; if(window.ic_update_syntax) window.ic_update_syntax(this);" onscroll="this.previousElementSibling.scrollTop = this.scrollTop;" onclick="if(window.ic_update_syntax) window.ic_update_syntax(this);" onkeyup="if(window.ic_update_syntax) window.ic_update_syntax(this);" onchange="sendWorkflowUpdate(this)"></textarea>
        </div>

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
    const collapsedPromptWrap = document.getElementById('ic-sidebar-prompt-wrap');
    const collapsedPrompt = document.getElementById('ic-sidebar-prompt');
    const workflowHtml = document.getElementById('ic_workflow_html');
    const titleEl = document.getElementById('ic-sidebar-title');

    // Drag state
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let hasMoved = false;

    // Remember collapsed position constraints
    let collapsedState = {
        left: 'auto',
        right: '20px',
        top: '56px'
    };

    sidebar.addEventListener('mousedown', (e) => {
        if (sidebar.getAttribute('data-ic-state') === 'expanded') return;
        
        // Ignore interactive elements
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('.ic-sidebar-plugin-card')) {
            return;
        }

        isDragging = true;
        hasMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        const containerRect = document.getElementById('ic-container').getBoundingClientRect();
        const rect = sidebar.getBoundingClientRect();
        
        initialLeft = rect.left - containerRect.left;
        initialTop = rect.top - containerRect.top;
        
        sidebar.style.transition = 'none'; // Disable transition during drag
        sidebar.style.right = 'auto';
        sidebar.style.bottom = 'auto';
        sidebar.style.left = initialLeft + 'px';
        sidebar.style.top = initialTop + 'px';
        sidebar.style.transform = 'none';
        
        document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        
        if (hasMoved) {
            const containerRect = document.getElementById('ic-container').getBoundingClientRect();
            const rect = sidebar.getBoundingClientRect();
            const toolbar = document.getElementById('ic-floating-toolbar');
            const menuBar = document.getElementById('ic-menu-bar');
            
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            // Top bounds (menu bar + padding)
            let minTop = 10;
            if (menuBar) {
                const mRect = menuBar.getBoundingClientRect();
                minTop = (mRect.bottom - containerRect.top) + 10;
            }
            
            // Bottom bounds (floating toolbar + padding)
            let maxTop = containerRect.height - rect.height - 10;
            if (toolbar) {
                const tRect = toolbar.getBoundingClientRect();
                const toolbarTopInContainer = tRect.top - containerRect.top;
                maxTop = Math.min(maxTop, toolbarTopInContainer - rect.height - 10);
            }
            
            // Constrain to container
            newLeft = Math.max(10, Math.min(newLeft, containerRect.width - rect.width - 10));
            newTop = Math.max(minTop, Math.min(newTop, maxTop));
            
            sidebar.style.left = newLeft + 'px';
            sidebar.style.top = newTop + 'px';
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
        sidebar.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1), right 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        
        if (hasMoved) {
            const containerRect = document.getElementById('ic-container').getBoundingClientRect();
            const rect = sidebar.getBoundingClientRect();
            
            const isRightHalf = (rect.left + rect.width / 2) > (containerRect.width / 2);
            collapsedState.top = (rect.top - containerRect.top) + 'px';
            
            if (isRightHalf) {
                const rightDist = containerRect.width - (rect.left - containerRect.left + rect.width);
                collapsedState.right = rightDist + 'px';
                collapsedState.left = 'auto';
                
                sidebar.style.left = 'auto';
                sidebar.style.right = rightDist + 'px';
            } else {
                const leftDist = rect.left - containerRect.left;
                collapsedState.left = leftDist + 'px';
                collapsedState.right = 'auto';
                
                sidebar.style.left = leftDist + 'px';
                sidebar.style.right = 'auto';
            }
        }
    });

    sidebar.addEventListener('dblclick', (e) => {
        if (sidebar.getAttribute('data-ic-state') === 'expanded') return;
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('.ic-sidebar-plugin-card')) return;
        
        sidebar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        sidebar.style.left = 'auto';
        sidebar.style.top = '56px';
        sidebar.style.right = '20px';
        sidebar.style.bottom = 'auto';
        sidebar.style.transform = 'none';
        
        collapsedState = { left: 'auto', right: '20px', top: '56px' };
        
        setTimeout(() => {
            sidebar.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1), right 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        }, 300);
    });

    function setSidebarState(state) {
        const expanded = (state === 'expanded');
        sidebar.setAttribute('data-ic-state', state);
        
        const containerEl = document.getElementById('ic-container');
        const toolbar = document.getElementById('ic-floating-toolbar');
        const cRect = containerEl ? containerEl.getBoundingClientRect() : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
        
        // Calculate max available height dodging toolbar
        let avail = 0;
        let toolbarTopInContainer = cRect.height;
        if (toolbar && containerEl) {
            const tRect = toolbar.getBoundingClientRect();
            toolbarTopInContainer = tRect.top - cRect.top;
        }
        
        // Expansion geometry computation (Intelligent Anchoring)
        if (expanded) {
            const expandedWidth = 550;
            
            if (collapsedState.right !== 'auto') {
                // Anchored to right. Expand leftward (right edge stays completely frozen).
                const currentRight = parseFloat(collapsedState.right);
                if (cRect.width - currentRight - expandedWidth < 10) {
                    // Overflows left edge, shift right
                    sidebar.style.right = Math.max(10, cRect.width - expandedWidth - 10) + 'px';
                } else {
                    sidebar.style.right = collapsedState.right;
                }
                sidebar.style.left = 'auto';
            } else {
                // Anchored to left. Expand rightward (left edge stays completely frozen).
                const currentLeft = parseFloat(collapsedState.left);
                if (currentLeft + expandedWidth > cRect.width - 20) {
                    // Overflows right edge, shift left
                    sidebar.style.left = Math.max(10, cRect.width - expandedWidth - 20) + 'px';
                } else {
                    sidebar.style.left = collapsedState.left;
                }
                sidebar.style.right = 'auto';
            }
            
            sidebar.style.top = collapsedState.top;
            sidebar.style.width = expandedWidth + 'px';
            
            const currentTop = parseFloat(collapsedState.top) || 56;
            avail = Math.max(120, toolbarTopInContainer - currentTop - 12);
        } else {
            // Collapse
            sidebar.style.width = '340px';
            sidebar.style.left = collapsedState.left;
            sidebar.style.right = collapsedState.right;
            sidebar.style.top = collapsedState.top;
            
            const currentTop = parseFloat(collapsedState.top) || 56;
            avail = Math.max(120, toolbarTopInContainer - currentTop - 12);
        }

        sidebar.style.maxHeight = avail + 'px';

        // Toggle inner panels. #ic_workflow_html animates via max-height +
        // opacity. The collapsed prompt textarea uses display:none instead —
        // its min-height:32px would otherwise defeat max-height:0 (min-height
        // wins per CSS spec), leaving a 32px sliver visible when expanded.
        if (expanded) {
            // Reserve room for header (38px) + sidebar padding (28px) = 66px
            const innerMax = Math.max(80, avail - 66);
            workflowHtml.style.maxHeight = innerMax + 'px';
            workflowHtml.style.opacity = '1';
            workflowHtml.style.pointerEvents = 'auto';
            if (collapsedPromptWrap) collapsedPromptWrap.style.display = 'none';
        } else {
            const innerMax = Math.max(80, avail - 66);
            workflowHtml.style.maxHeight = '0px';
            workflowHtml.style.opacity = '0';
            workflowHtml.style.pointerEvents = 'none';
            if (collapsedPromptWrap) collapsedPromptWrap.style.display = 'block';
            collapsedPrompt.style.maxHeight = innerMax + 'px';
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
                ta.style.height = Math.max(32, ta.scrollHeight + 2) + 'px';
            });
        } else {
            // Mirror current prompt value into the collapsed textarea.
            const expandedPrompt = workflowHtml.querySelector('.ic-node-param[data-node-id="parse_input"][data-param-name="prompt"]');
            if (expandedPrompt && expandedPrompt.value !== collapsedPrompt.value) {
                collapsedPrompt.value = expandedPrompt.value;
                if (window.ic_update_syntax) window.ic_update_syntax(collapsedPrompt);
            }
            collapsedPrompt.style.height = 'auto';
            collapsedPrompt.style.height = Math.max(32, collapsedPrompt.scrollHeight + 2) + 'px';
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
            if (window.ic_update_syntax) window.ic_update_syntax(collapsedPrompt);
        }
        collapsedPrompt.style.height = 'auto';
        collapsedPrompt.style.height = Math.max(32, collapsedPrompt.scrollHeight + 2) + 'px';
        if (sidebar.getAttribute('data-ic-state') === 'expanded') {
            workflowHtml.querySelectorAll('textarea.ic-node-param').forEach(ta => {
                ta.style.height = 'auto';
                ta.style.height = Math.max(32, ta.scrollHeight + 2) + 'px';
            });
        }
    });
    obs.observe(workflowHtml, { childList: true, subtree: true, characterData: true });

    // Initial autosize of the collapsed prompt.
    setTimeout(() => {
        collapsedPrompt.style.height = 'auto';
        collapsedPrompt.style.height = Math.max(32, collapsedPrompt.scrollHeight + 2) + 'px';
    }, 0);

    // Keep collapsed prompt height perfectly in sync during the 0.3s width transition
    if (window.ResizeObserver) {
        new ResizeObserver(() => {
            if (sidebar.getAttribute('data-ic-state') !== 'expanded' && collapsedPrompt.style.display !== 'none') {
                collapsedPrompt.style.height = 'auto';
                collapsedPrompt.style.height = Math.max(32, collapsedPrompt.scrollHeight + 2) + 'px';
            }
        }).observe(sidebar);
    }

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
