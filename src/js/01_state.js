const canvas = document.getElementById('ic-canvas');
    const container = document.getElementById('ic-container');
    
    const guideModalHTML = `
    <div id="ic-guide-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3000; justify-content: center; align-items: center;">
        <div style="background: var(--body-background-fill, #1e1e1e); color: var(--body-text-color, #e0e0e0); padding: 30px; border-radius: 12px; width: 80%; max-width: 600px; max-height: 80%; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: sans-serif; position: relative; border: 1px solid #444;">
            <button id="ic-guide-close" style="position: absolute; top: 15px; right: 15px; background: transparent; border: none; font-size: 24px; color: #888; cursor: pointer; line-height: 1;">&times;</button>
            <h2 style="margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 10px;">${t('📖 Infinite Canvas Guide')}</h2>
            
            <div style="line-height: 1.6; font-size: 14px;">
                <p><strong>${t('👆 Basics & Navigation')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li><strong>${t('Pan Canvas')}:</strong> ${t('Pan Canvas Desc')}</li>
                    <li><strong>${t('Zoom')}:</strong> ${t('Zoom Desc')}</li>
                </ul>
                
                <p><strong>${t('🟦 The Generation Area (Blue Box)')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li><strong>${t('Move Box')}:</strong> ${t('Move Box Desc')}</li>
                    <li><strong>${t('Rotate Box')}:</strong> ${t('Rotate Box Desc')}</li>
                </ul>
                
                <p><strong>${t('🖌️ Drawing Masks')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li>${t('Draw Mask Desc 1')}</li>
                    <li>${t('Draw Mask Desc 2')}</li>
                </ul>
                
                <p><strong>${t('🔄 Undo/Redo & Generation')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li>${t('Undo Desc 1')}</li>
                    <li>${t('Undo Desc 2')}</li>
                </ul>
            </div>
        </div>
    </div>`;

    const limitModalHTML = `
    <div id="ic-limit-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 3100; justify-content: center; align-items: center;">
        <div style="background: var(--body-background-fill, #1e1e1e); color: var(--body-text-color, #e0e0e0); padding: 30px; border-radius: 12px; width: 80%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: sans-serif; position: relative; border: 1px solid #444; text-align: center;">
            <h2 style="margin-top: 0; color: #ff5555; margin-bottom: 15px;">${t('⚠️ 尺寸超限警告')}</h2>
            <p style="margin-bottom: 25px; line-height: 1.5; color: var(--body-text-color, #e0e0e0);">${t('蓝框尺寸即将超过 8192x8192！<br>继续扩大极大概率导致显存溢出 (OOM)。')}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="ic-limit-cancel" class="res-preset-btn" style="flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">${t('取消操作并保持限制')}</button>
                <button id="ic-limit-unlock" class="res-preset-btn primary" style="flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer;">${t('解除限制 (不再提示)')}</button>
            </div>
        </div>
    </div>`;

    container.insertAdjacentHTML('beforeend', guideModalHTML);
    container.insertAdjacentHTML('beforeend', limitModalHTML);
    
    document.getElementById('ic-guide-close').addEventListener('click', () => {
        document.getElementById('ic-guide-modal').style.display = 'none';
    });

    document.getElementById('ic-limit-cancel')?.addEventListener('click', () => {
        document.getElementById('ic-limit-modal').style.display = 'none';
    });

    document.getElementById('ic-limit-unlock')?.addEventListener('click', () => {
        window.ic_ignore_size_limit = true;
        document.getElementById('ic-limit-modal').style.display = 'none';
    });
    
    // Inject Modal HTML
    const modalHTML = `
    <div id="ic-modal-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:2500; flex-direction:column; font-family:sans-serif;">
        <div style="flex:1; display:flex; flex-direction:row; overflow:hidden;">
            <div style="flex:1; position:relative; border-right:2px solid #222;">
                <div style="position:absolute; top:15px; left:15px; background:rgba(0,0,0,0.7); color:white; padding:8px 12px; border-radius:6px; z-index:10; font-size:14px; pointer-events:none;">${t('Before')}</div>
                <canvas id="ic-modal-canvas-old" style="width:100%; height:100%; cursor:grab;"></canvas>
            </div>
            <div style="flex:1; position:relative;">
                <div style="position:absolute; top:15px; left:15px; background:rgba(0,0,0,0.7); color:white; padding:8px 12px; border-radius:6px; z-index:10; font-size:14px; pointer-events:none;">${t('After')}</div>
                <canvas id="ic-modal-canvas-new" style="width:100%; height:100%; cursor:grab;"></canvas>
            </div>
        </div>
        <div style="height:70px; background:#1a1a1a; display:flex; align-items:center; justify-content:space-between; padding:0 30px;">
            <div style="display:flex; align-items:center; gap:15px; color:white;">
                <label for="ic-modal-feather" style="font-weight:bold; color: white; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">${t('Feather Radius (px): ')}<span id="ic-modal-feather-val">0</span></label>
                <input type="range" id="ic-modal-feather" min="0" max="64" value="0" style="width:200px; cursor:pointer;">
            </div>
            <div style="display:flex; gap:20px;">
                <button id="ic-modal-toggle-edge" style="display:none; padding:12px 20px; background:#555; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px; transition:background 0.2s;">${t('🔆 Highlight Edge Fix')}</button>
                <button id="ic-modal-discard" style="padding:12px 40px; background:#444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px; transition:background 0.2s;">${t('❌ Discard')}</button>
                <button id="ic-modal-apply" style="padding:12px 40px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px; transition:background 0.2s;">${t('✅ Apply Changes')}</button>
            </div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', modalHTML);
    
    const sessionModalHTML = `
    <div id="ic-session-modal" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:2000; flex-direction:column; font-family:sans-serif; align-items:center; justify-content:center;">
        <div style="background:#222; padding:30px; border-radius:12px; display:flex; flex-direction:column; align-items:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <h2 style="color:white; margin-top:0;">${t('Continue Previous Session?')}</h2>
            <img id="ic-session-preview" src="" style="max-width:512px; max-height:512px; border:2px solid #555; border-radius:8px; margin-bottom:25px; background:repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px;">
            <div style="display:flex; gap:20px; width:100%;">
                <button id="ic-session-no" style="flex:1; padding:12px 20px; background:#444; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px; transition:background 0.2s;">${t('Start Fresh')}</button>
                <button id="ic-session-yes" style="flex:1; padding:12px 20px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px; transition:background 0.2s;">${t('Restore Canvas')}</button>
            </div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', sessionModalHTML);

    // --- FLOATING TOOLBAR INJECTION ---
    const floatingToolbarHTML = `
    <div id="ic-floating-toolbar" style="
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 12px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        pointer-events: auto;
        user-select: none;
        width: max-content;
        max-width: 95%;
    ">
        <!-- Top Row: Tools & Undo/Redo & Toggles -->
        <div style="display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px;">
            <button id="ic_float_undo" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Canvas ⏪')}</button>
            <button id="ic_float_redo" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Canvas ⏩')}</button>

            <div style="min-width: 1px; height: 24px; background: rgba(0,0,0,0.1); margin: 0 4px;"></div>

            <button id="ic_float_mask_undo" class="res-preset-btn disabled-state" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Mask ⏪')}</button>
            <button id="ic_float_mask_redo" class="res-preset-btn disabled-state" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Mask ⏩')}</button>
            
            <div style="min-width: 1px; height: 24px; background: rgba(0,0,0,0.1); margin: 0 4px;"></div>
            
            <button id="ic_float_rect" class="res-preset-btn primary float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Rect')}">🔲</button>
            <button id="ic_float_brush" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Brush')}">🖌️</button>
            <button id="ic_float_ellipse" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Ellipse')}">🔵</button>
            <button id="ic_float_eraser" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Eraser')}">🧼</button>
            <button id="ic_float_magic" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('🪄 Magic Wand')} \n${t('Click inside the blue box to auto-segment')}">🪄</button>
            
            <div style="min-width: 1px; height: 24px; background: rgba(0,0,0,0.1); margin: 0 4px;"></div>
            
            <button id="ic_float_overlay" class="res-preset-btn primary" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Show Overlays')}</button>
            <button id="ic_float_autoscale" class="res-preset-btn primary" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Auto Scale Canvas')}</button>
        </div>
        
        <!-- Floating Popup for Brush Size -->
        <div id="ic_brush_slider_popup" style="opacity: 0; pointer-events: none; position: absolute; top: -55px; left: 50%; transform: translateX(-50%) translateY(10px) scale(0.95); transition: opacity 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 5px; align-items: center; z-index: 1001;">
            <div style="font-size: 11px; color: #555; font-weight: bold; margin-bottom: 2px;">${typeof t === 'function' ? t('Brush Size') : 'Brush Size'}: <span id="ic_float_brush_size_val" style="font-family: monospace; color: #111; font-size: 13px;">10</span></div>
            <input type="range" id="ic_float_brush_size" min="0" max="100" value="10" style="width: 120px; cursor: pointer; margin: 0;">
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid rgba(255, 255, 255, 0.95);"></div>
        </div>
        
        <!-- Bottom Row: Presets & Actions -->
        <div style="display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: nowrap; overflow-x: auto;">
            <div class="res-preset-container" style="min-width: unset; height: auto;">
                <div class="res-preset-btn" onclick="ic_setRes(1024,1024)" title="1024 x 1024"><div class="res-preset-icon" style="width: 24px; height: 24px;">1K</div></div>
                <div class="res-preset-btn" onclick="ic_setRes(832,1216)" title="832 x 1216"><div class="res-preset-icon" style="width: 16px; height: 24px;"><span style="transform: scale(0.85);">1K</span></div></div>
                <div class="res-preset-btn" onclick="ic_setRes(1216,832)" title="1216 x 832"><div class="res-preset-icon" style="width: 24px; height: 16px;">1K</div></div>
                <div class="res-preset-btn" onclick="ic_setRes(1024,1280)" title="1024 x 1280"><div class="res-preset-icon" style="width: 19px; height: 24px;"><span style="transform: scale(0.85);">1K</span></div></div>
                <div class="res-preset-btn" onclick="ic_setRes(1280,1024)" title="1280 x 1024"><div class="res-preset-icon" style="width: 24px; height: 19px;"><span style="transform: scale(0.85);">1K</span></div></div>
                <div class="res-preset-btn" onclick="ic_setRes(768,1344)" title="768 x 1344"><div class="res-preset-icon" style="width: 14px; height: 24px;"><span style="transform: scale(0.75);">1K</span></div></div>
                <div class="res-preset-btn" onclick="ic_setRes(1344,768)" title="1344 x 768"><div class="res-preset-icon" style="width: 24px; height: 14px;"><span style="transform: scale(0.75);">1K</span></div></div>
                <div class="res-preset-btn" onclick="ic_setRes(704,1472)" title="704 x 1472"><div class="res-preset-icon" style="width: 11px; height: 24px;"><span style="transform: scale(0.65);">1K</span></div></div>
                <div class="res-preset-btn" onclick="ic_setRes(1472,704)" title="1472 x 704"><div class="res-preset-icon" style="width: 24px; height: 11px;"><span style="transform: scale(0.65);">1K</span></div></div>
            </div>
            
            <div style="min-width: 1px; height: 24px; background: rgba(0,0,0,0.1); margin: 0 4px;"></div>
            
            <button id="ic_float_clear" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Clear Mask')}</button>
            <button id="ic_float_reset" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Reset Canvas')}</button>
            <button id="ic_float_download" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Download Canvas')}</button>
            <button id="ic_float_copy" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Copy Canvas')}</button>
            <button id="ic_float_guide" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 13px;">${t('📖 Guide')}</button>
        </div>
    </div>
    <style>
    .res-preset-btn {
        background: #ffffff !important;
        color: #333333 !important;
        border: 1px solid #dddddd !important;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 36px !important;
        font-family: sans-serif;
        font-weight: 500;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        box-sizing: border-box !important;
        margin: 0 !important;
        white-space: nowrap !important;
        line-height: 1 !important;
    }
    .res-preset-btn:hover {
        background: #f2f2f2 !important;
        border-color: #cccccc !important;
    }
    .res-preset-btn.primary {
        background: cornflowerblue !important;
        border-color: cornflowerblue !important;
        color: white !important;
        box-shadow: 0 2px 6px rgba(100, 149, 237, 0.3);
    }
    .res-preset-btn.primary:hover {
        background: #5a85de !important;
        border-color: #5a85de !important;
    }
    .res-preset-icon {
        border: 2px solid currentColor;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: bold;
        border-radius: 2px;
        box-sizing: border-box;
        overflow: hidden;
    }
        .res-preset-btn.disabled-state {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
        pointer-events: none !important;
    }
    .res-preset-container {
        display: flex;
        flex-wrap: nowrap;
        gap: 4px;
        align-items: center;
    }
    </style>
    `;
    if (!document.getElementById('ic-floating-toolbar')) {
        container.insertAdjacentHTML('beforeend', floatingToolbarHTML);
    }
    
    // Bind Floating Toolbar Events
    setTimeout(() => {
    // Automatically hide toolbar when modals are visible
    const icContainer = document.getElementById('ic-container');
    const icToolbar = document.getElementById('ic-floating-toolbar');
    if (icContainer && icToolbar) {
        const observer = new MutationObserver(() => {
            const m1 = document.getElementById('ic-modal-overlay');
            const m2 = document.getElementById('ic-session-modal');
            const m3 = document.getElementById('ic-guide-modal');
            
            const isAnyModalOpen = (m1 && m1.style.display !== 'none') || 
                                   (m2 && m2.style.display !== 'none') || 
                                   (m3 && m3.style.display !== 'none');
                                   
            if (isAnyModalOpen) {
                icToolbar.style.display = 'none';
            } else {
                icToolbar.style.display = 'flex';
            }
        });
        
        observer.observe(icContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }

        // Tools
        const tools = ['rect', 'brush', 'ellipse', 'eraser', 'magic'];
        const toolsWithSlider = ['brush', 'eraser', 'magic'];
        const brushPopup = document.getElementById('ic_brush_slider_popup');
        
        // Hide popup when clicking outside
        document.addEventListener('mousedown', (e) => {
            if (brushPopup && brushPopup.style.opacity === '1') {
                const isClickInsidePopup = brushPopup.contains(e.target);
                let isClickOnToolBtn = false;
                tools.forEach(t => {
                    const btn = document.getElementById('ic_float_' + t);
                    if (btn && btn.contains(e.target)) isClickOnToolBtn = true;
                });
                if (!isClickInsidePopup && !isClickOnToolBtn) {
                    brushPopup.style.opacity = '0';
                    brushPopup.style.pointerEvents = 'none';
                    brushPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                }
            }
        });

        tools.forEach(t => {
            const floatBtn = document.getElementById('ic_float_' + t);
            if (floatBtn) {
                floatBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const toolName = t.charAt(0).toUpperCase() + t.slice(1);
                    const isAlreadySelected = window.ic_current_tool === toolName;
                    
                    window.ic_current_tool = toolName;
                    document.querySelectorAll('.float-tool-btn').forEach(b => b.classList.remove('primary'));
                    floatBtn.classList.add('primary');
                    
                    if (toolsWithSlider.includes(t)) {
                        if (isAlreadySelected) {
                            // Toggle popup
                            if (brushPopup.style.opacity === '0') {
                                brushPopup.style.opacity = '1';
                                brushPopup.style.pointerEvents = 'auto';
                                brushPopup.style.transform = 'translateX(-50%) translateY(0) scale(1)';
                                
                                const btnRect = floatBtn.getBoundingClientRect();
                                const toolbarRect = document.getElementById('ic-floating-toolbar').getBoundingClientRect();
                                const offsetLeft = (btnRect.left + btnRect.width / 2) - toolbarRect.left;
                                brushPopup.style.left = offsetLeft + 'px';
                                // Align exactly above button
                                const offsetTop = (btnRect.top - toolbarRect.top) - 60;
                                brushPopup.style.top = offsetTop + 'px';
                            } else {
                                brushPopup.style.opacity = '0';
                                brushPopup.style.pointerEvents = 'none';
                                brushPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                            }
                        } else {
                            if (brushPopup) {
                                brushPopup.style.opacity = '0';
                                brushPopup.style.pointerEvents = 'none';
                                brushPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                            }
                        }
                    } else {
                        if (brushPopup) {
                            brushPopup.style.opacity = '0';
                            brushPopup.style.pointerEvents = 'none';
                            brushPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                        }
                    }
                });
            }
        });
        
        // Undo / Redo
        document.getElementById('ic_float_undo')?.addEventListener('click', () => document.getElementById('ic_prev_btn')?.click());
        document.getElementById('ic_float_redo')?.addEventListener('click', () => document.getElementById('ic_now_btn')?.click());

        // Mask Undo / Redo
        document.getElementById('ic_float_mask_undo')?.addEventListener('click', undoMask);
        document.getElementById('ic_float_mask_redo')?.addEventListener('click', redoMask);

        // Keyboard shortcuts for mask undo/redo: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
        document.addEventListener('keydown', (e) => {
            // Only handle when the canvas container is visible and no modal/input is focused
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
            if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                undoMask();
            } else if ((e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'z')) || (e.ctrlKey && e.key === 'y')) {
                e.preventDefault();
                redoMask();
            }
        });
        
        // Sync disabled state
        function syncDisabledState(sourceId, targetId) {
            const src = document.getElementById(sourceId);
            const tgt = document.getElementById(targetId);
            if (src && tgt) {
                const updateState = () => {
                    tgt.disabled = src.disabled || src.classList.contains('disabled');
                    if (tgt.disabled) tgt.classList.add('disabled-state');
                    else tgt.classList.remove('disabled-state');
                };
                updateState();
                const observer = new MutationObserver(updateState);
                observer.observe(src, { attributes: true, attributeFilter: ['disabled', 'class'] });
            }
        }
        syncDisabledState('ic_prev_btn', 'ic_float_undo');
        syncDisabledState('ic_now_btn', 'ic_float_redo');
        
        // Toggles
        const floatOverlayBtn = document.getElementById('ic_float_overlay');
        if (floatOverlayBtn) {
            floatOverlayBtn.addEventListener('click', () => {
                window.ic_show_overlay_state = !window.ic_show_overlay_state;
                
                const overlayCb = document.querySelector('#ic_show_overlay input[type="checkbox"]');
                if(overlayCb && overlayCb.checked !== window.ic_show_overlay_state) overlayCb.click();
                
                if (window.ic_show_overlay_state) floatOverlayBtn.classList.add('primary');
                else floatOverlayBtn.classList.remove('primary');
                
                const sidebarOverlayBtn = document.getElementById('ic_show_overlay_btn');
                if (sidebarOverlayBtn) {
                    if (window.ic_show_overlay_state) {
                        sidebarOverlayBtn.classList.add('primary');
                        sidebarOverlayBtn.classList.remove('secondary');
                    } else {
                        sidebarOverlayBtn.classList.add('secondary');
                        sidebarOverlayBtn.classList.remove('primary');
                    }
                }
                
                if (typeof draw === 'function') draw();
            });
        }
        const floatAutoScaleBtn = document.getElementById('ic_float_autoscale');
        if (floatAutoScaleBtn) {
            floatAutoScaleBtn.addEventListener('click', () => {
                window.ic_auto_scale_state = !window.ic_auto_scale_state;
                
                const autoScaleCb = document.querySelector('#ic_auto_scale input[type="checkbox"]');
                if(autoScaleCb && autoScaleCb.checked !== window.ic_auto_scale_state) autoScaleCb.click();
                
                if (window.ic_auto_scale_state) floatAutoScaleBtn.classList.add('primary');
                else floatAutoScaleBtn.classList.remove('primary');
                
                const sidebarAutoScaleBtn = document.getElementById('ic_auto_scale_btn');
                if (sidebarAutoScaleBtn) {
                    if (window.ic_auto_scale_state) {
                        sidebarAutoScaleBtn.classList.add('primary');
                        sidebarAutoScaleBtn.classList.remove('secondary');
                    } else {
                        sidebarAutoScaleBtn.classList.add('secondary');
                        sidebarAutoScaleBtn.classList.remove('primary');
                    }
                }
            });
        }
        
        // Actions
        document.getElementById('ic_float_clear')?.addEventListener('click', () => {
            document.getElementById('ic_clear_mask')?.click();
        });
        document.getElementById('ic_float_reset')?.addEventListener('click', () => document.getElementById('ic_reset_btn')?.click());
        document.getElementById('ic_float_download')?.addEventListener('click', () => document.getElementById('ic_download_btn')?.click());
        const floatCopyBtn = document.getElementById('ic_float_copy');
        if (floatCopyBtn) {
            floatCopyBtn.addEventListener('click', () => {
                if (bgImage && bgImage.src) {
                    fetch(bgImage.src)
                        .then(res => res.blob())
                        .then(blob => {
                            const item = new ClipboardItem({ 'image/png': blob });
                            navigator.clipboard.write([item]).then(() => {
                                const oldText = floatCopyBtn.innerText;
                                floatCopyBtn.innerText = typeof t === 'function' ? t('Copied!') : 'Copied!';
                                setTimeout(() => {
                                    floatCopyBtn.innerText = oldText;
                                }, 2000);
                            }).catch(e => {
                                console.error('Copy failed:', e);
                            });
                        });
                }
            });
        }
        document.getElementById('ic_float_guide')?.addEventListener('click', () => document.getElementById('ic_guide_btn')?.click());
        
        const brushSizeSlider = document.getElementById('ic_float_brush_size');
        const brushSizeVal = document.getElementById('ic_float_brush_size_val');
        if (brushSizeSlider && brushSizeVal) {
            window.ic_brush_size = parseInt(brushSizeSlider.value, 10);
            brushSizeSlider.addEventListener('input', (e) => {
                brushSizeVal.innerText = e.target.value;
                window.ic_brush_size = parseInt(e.target.value, 10);
            });
        }
    }, 1000);


    const ctx = canvas.getContext('2d');
    
    // Initial size
    
    
    setTimeout(() => {
        const btn = document.getElementById('ic_check_session_btn');
        if (btn) btn.click();
    }, 1500);
    
    
    const resizeObserver = new ResizeObserver(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
            const dpr = window.devicePixelRatio || 1;
            const targetW = Math.round(container.clientWidth * dpr);
            const targetH = Math.round(container.clientHeight * dpr);
            if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW;
                canvas.height = targetH;
                canvas.style.width = container.clientWidth + 'px';
                canvas.style.height = container.clientHeight + 'px';
                if (typeof draw === 'function') draw();
            }
        }
    });
    resizeObserver.observe(container);
    
    let scale = 1.0;
    let offsetX = canvas.width / 2 - 512;
    let offsetY = canvas.height / 2 - 512;
    
    let bgImage = new Image();
    bgImage.onload = () => draw();
    bgImage.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='; 
    
    let isDraggingCanvas = false;
    let isDraggingSource = false;
    let isRotatingSource = false;
    let isDrawingRect = false;
    let isDrawingBrush = false;
    let isDrawingEllipse = false;
    let dragStartX = 0;
    let dragStartY = 0;
    
    let sourceRect = {x: 0, y: 0, w: 1024, h: 1024, angle: 0};
    let targetRect = {x: 256, y: 256, w: 512, h: 512};
    
    // Pixel-based mask bound to sourceRect
    let maskDataCanvas = document.createElement('canvas');
    maskDataCanvas.width = sourceRect.w;
    maskDataCanvas.height = sourceRect.h;
    let maskDataCtx = maskDataCanvas.getContext('2d', { willReadFrequently: true });

    // Mask undo/redo history (snapshot on each mouseup after a stroke)
    let maskHistory = [];
    let maskHistoryIndex = -1;
    const MASK_HISTORY_LIMIT = 30;

    // Cached tint canvas for visualization
    let tintCanvas = document.createElement('canvas');
    let tintCtx = tintCanvas.getContext('2d');
    
    let currentStroke = null;

    window.ic_current_tool = 'Rect';

    // Save initial blank mask state as undo baseline
    setTimeout(() => { saveMaskState(); }, 0);

    // UI State Getters
    window.ic_show_overlay_state = true;
    window.ic_auto_scale_state = true;
    window.ic_ignore_size_limit = false;

    window.getShowOverlays = function() {
        return window.ic_show_overlay_state;
    };

    window.getAutoScale = function() {
        return window.ic_auto_scale_state;
    };
