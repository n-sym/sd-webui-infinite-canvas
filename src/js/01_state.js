const IC_ICONS = {
    undo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M320-200q-17 0-28.5-11.5T280-240q0-17 11.5-28.5T320-280h244q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l76 76q11 11 11 28t-11 28q-11 11-28 11t-28-11L188-572q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l144-144q11-11 28-11t28 11q11 11 11 28t-11 28l-76 76h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H320Z"/></svg>`,
    redo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M648-560H396q-63 0-109.5 40T240-420q0 60 46.5 100T396-280h244q17 0 28.5 11.5T680-240q0 17-11.5 28.5T640-200H396q-97 0-166.5-63T160-420q0-94 69.5-157T396-640h252l-76-76q-11-11-11-28t11-28q11-11 28-11t28 11l144 144q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L628-428q-11 11-28 11t-28-11q-11-11-11-28t11-28l76-76Z"/></svg>`,
    rectangle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z"/></svg>`,
    brush: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M240-120q-45 0-89-22t-71-58q26 0 53-20.5t27-59.5q0-50 35-85t85-35q50 0 85 35t35 85q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T320-280q0-17-11.5-28.5T280-320q-17 0-28.5 11.5T240-280q0 23-5.5 42T220-202q5 2 10 2h10Zm230-160L360-470l358-358q11-11 27.5-11.5T774-828l54 54q12 12 12 28t-12 28L470-360Zm-190 80Z"/></svg>`,
    circle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`,
    ink_eraser: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M690-240h150q17 0 28.5 11.5T880-200q0 17-11.5 28.5T840-160H610l80-80Zm-483 80q-8 0-15.5-3t-13.5-9l-73-73q-23-23-23.5-57t22.5-58l440-456q23-24 56.5-24t56.5 23l199 199q23 23 23 57t-23 57L532-172q-6 6-13.5 9t-15.5 3H207Zm279-80 314-322-198-198-442 456 64 64h262Zm-6-240Z"/></svg>`,
    auto_fix_high: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="m20 7-.95-2.05L17 4l2.05-.95L20 1l.95 2.05L23 4l-2.05.95ZM8.5 7l-.95-2.05L5.5 4l2.05-.95L8.5 1l.95 2.05L11.5 4l-2.05.95ZM20 18.5l-.95-2.05L17 15.5l2.05-.95.95-2.05.95 2.05 2.05.95-2.05.95ZM5.1 21.7l-2.8-2.8q-.3-.3-.3-.725t.3-.725L13.45 6.3q.3-.3.725-.3t.725.3l2.8 2.8q.3.3.3.725t-.3.725L6.55 21.7q-.3.3-.725.3t-.725-.3Zm.75-2.1L13 12.4 11.6 11l-7.2 7.15Z"/></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>`,
    crop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M240-240v-480h-80v-80h80v-80h80v80h480v80H320v400h80v80h-80v80h-80v-80H240Zm400-160v-320H400v-80h320v400h-80Z"/></svg>`,
    projects: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>`,
    save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"/></svg>`,
    import: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M260-160q-42 0-71-29t-29-71v-440q0-42 29-71t71-29h440q42 0 71 29t29 71v440q0 42-29 71t-71 29H260Zm0-80h440v-440H260v440Zm220-60 160-160-56-56-64 64v-168h-80v168l-64-64-56 56 160 160Zm-220 60v-440 440Z"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>`,
    chevron_right: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor"><path d="M256-200l-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>`
};

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
                    <li><strong>${t('Pan Canvas')}:</strong> ${t('Hold <kbd>Alt</kbd> + Left click / Right click outside the blue box to pan the canvas. Click Middle Mouse Button to reset camera.')}</li>
                    <li><strong>${t('Zoom Canvas')}:</strong> ${t('Use the mouse wheel to zoom in and out.')}</li>
                </ul>
                
                <p><strong>${t('🟦 The Generation Area (Blue Box)')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li><strong>${t('Properties')}:</strong> ${t('Appears as a blue dashed box. This area is fed into the generation model, hereafter referred to as the [Blue Box].')}</li>
                    <li><strong>${t('Move Box')}:</strong> ${t('Hold <kbd>Alt</kbd> + Left click / Right click inside the blue box to move it.')}</li>
                    <li><strong>${t('Rotate Box')}:</strong> ${t('Hold <kbd>Shift</kbd> + Left click drag anywhere to rotate the blue box.')}</li>
                </ul>
                
                <p><strong>${t('🖌️ Drawing Masks')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li>${t('Drag with the Left Mouse Button anywhere to draw masks. Masks outside the blue box will be ignored.')}</li>
                    <li>${t('When scaling the blue box, masks will be preserved as losslessly as possible.')}</li>
                    <li>${t('The logical resolution of the mask will not exceed twice the actual resolution of the blue box.')}</li>
                    <li>${t('Mask operations can be undone/redone. Panning is not considered a mask operation. Undo is bound to <kbd>Ctrl + Z</kbd>.')}</li>
                    <li>${t('The Magic Wand tool uses the SAM model, which requires an additional download and may take time depending on network conditions.')}</li>
                </ul>
                
                <p><strong>${t('🔄 Undo/Redo & Generation')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li>${t('After generation, a preview modal will pop up. You can adjust feathering before applying.')}</li>
                    <li>${t('You can use the Canvas Undo/Redo buttons in the toolbar to revert your actions anytime.')}</li>
                </ul>

                <p><strong>${t('💾 Project Management')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li>${t('You can load and save projects, retaining most of the temporary data during your workflow.')}</li>
                    <li>${t('There is a tutorial.infcanvas file in the extension root directory as an example project.')}</li>
                </ul>

                <p><strong>${t('🔌 Plugins')}</strong></p>
                <ul style="margin-bottom: 15px;">
                    <li>${t('There are currently several Built-In plugins available.')}</li>
                    <li>${t('More plugin-related features may be implemented in the future.')}</li>
                </ul>
            </div>
        </div>
    </div>`;

    container.insertAdjacentHTML('beforeend', guideModalHTML);
    
    document.getElementById('ic-guide-close').addEventListener('click', () => {
        document.getElementById('ic-guide-modal').style.display = 'none';
    });
    
    // Inject Modal HTML
    const modalHTML = `
    <div id="ic-modal-overlay" style="display:none; position:absolute; top:36px; left:0; width:100%; height:calc(100% - 36px); background:rgba(0,0,0,0.85); z-index:2400; flex-direction:column; font-family:sans-serif;">
        <div style="flex:1; display:flex; flex-direction:row; overflow:hidden;">
            <div style="flex:1; position:relative; border-right:2px solid var(--border-color-primary, #ccc); background-color: var(--checker-bg, #ffffff); background-image: linear-gradient(45deg, var(--checker-fg, #dfdfdf) 25%, transparent 25%, transparent 75%, var(--checker-fg, #dfdfdf) 75%, var(--checker-fg, #dfdfdf)), linear-gradient(45deg, var(--checker-fg, #dfdfdf) 25%, transparent 25%, transparent 75%, var(--checker-fg, #dfdfdf) 75%, var(--checker-fg, #dfdfdf)); background-size: 16px 16px; background-position: 0 0, 8px 8px;">
                <div style="position:absolute; top:15px; left:15px; background:rgba(0,0,0,0.7); color:white; padding:8px 12px; border-radius:6px; z-index:10; font-size:14px; pointer-events:none;">${t('Before')}</div>
                <canvas id="ic-modal-canvas-old" style="width:100%; height:100%; cursor:grab;"></canvas>
            </div>
            <div style="flex:1; position:relative; background-color: var(--checker-bg, #ffffff); background-image: linear-gradient(45deg, var(--checker-fg, #dfdfdf) 25%, transparent 25%, transparent 75%, var(--checker-fg, #dfdfdf) 75%, var(--checker-fg, #dfdfdf)), linear-gradient(45deg, var(--checker-fg, #dfdfdf) 25%, transparent 25%, transparent 75%, var(--checker-fg, #dfdfdf) 75%, var(--checker-fg, #dfdfdf)); background-size: 16px 16px; background-position: 0 0, 8px 8px;">
                <div style="position:absolute; top:15px; left:15px; background:rgba(0,0,0,0.7); color:white; padding:8px 12px; border-radius:6px; z-index:10; font-size:14px; pointer-events:none;">${t('After')}</div>
                <canvas id="ic-modal-canvas-new" style="width:100%; height:100%; cursor:grab;"></canvas>
            </div>
        </div>
        <div class="fluent-panel" style="position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 20px; padding: 12px 20px; border-radius: 100px; background: color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.1), inset 1px 1px 0 rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); z-index: 1000; user-select: none;">
            <div style="display:flex; align-items:center; gap:12px; color:var(--body-text-color, #e0e0e0); margin-right: 10px;">
                <label for="ic-modal-feather" style="font-weight:600; font-size: 14px;">${t('Feather Radius (px): ')}<span id="ic-modal-feather-val">0</span></label>
                <input type="range" id="ic-modal-feather" min="0" max="64" value="0" style="width:160px; cursor:pointer;">
            </div>
            <div style="display:flex; gap:12px;">
                <button id="ic-modal-discard" class="res-preset-btn" style="padding: 0px 24px; height: 38px; font-size: 14px; border-radius: 100px;">${t('Discard')}</button>
                <button id="ic-modal-apply" class="res-preset-btn primary" style="padding: 0px 24px; height: 38px; font-size: 14px; border-radius: 100px;">${t('Apply Changes')}</button>
            </div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', modalHTML);
    

    const projectsModalHTML = `
    <div id="ic-projects-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 3000; justify-content: center; align-items: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
        <div class="fluent-panel" style="background: color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent); color: var(--body-text-color, #e0e0e0); padding: 32px; border-radius: 24px; width: 90%; max-width: 480px; max-height: 90%; display: flex; flex-direction: column; overflow: hidden; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 1px 1px 0 rgba(255, 255, 255, 0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <span>${IC_ICONS.projects}</span>
                    <span>${t('Project Management')}</span>
                </h2>
                <button id="ic-projects-close" style="background: transparent; border: none; font-size: 24px; color: color-mix(in srgb, var(--body-text-color, #fff) 50%, transparent); cursor: pointer; line-height: 1; padding: 0;">&times;</button>
            </div>
            
            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                <input type="text" id="ic-projects-name-input" value="project" placeholder="${typeof t === 'function' ? t('Project Name') : 'Project Name'}" oninput="if(window.ic_set_project_name) window.ic_set_project_name(this.value)" style="flex: 1; box-sizing: border-box; height: 44px; background: color-mix(in srgb, var(--body-background-fill, #1e1e1e) 97%, var(--body-text-color, #fff)); border: none; border-radius: 12px; color: var(--body-text-color, #fff); padding: 0 16px; outline: none; font-size: 15px; font-weight: 500; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                <button id="ic-projects-save-btn" class="res-preset-btn primary" style="height: 44px; padding: 0 20px; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0;">
                    <span style="font-size: 18px; line-height: 1; display: inline-flex; color: cornflowerblue;">${IC_ICONS.save}</span> ${t('Save')}
                </button>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: color-mix(in srgb, var(--body-text-color, #fff) 60%, transparent); font-weight: 700;">${t('Existing Projects')}</div>
                <button id="ic-projects-import-btn" class="res-preset-btn" style="height: 36px; padding: 0 14px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 16px; line-height: 1; display: inline-flex; color: cornflowerblue;">${IC_ICONS.import}</span> ${t('Import Project')}
                </button>
            </div>
            
            <div id="ic-projects-list" style="flex: 1 1 auto; min-height: 0; overflow-y: auto; display: block; padding-right: 8px; padding-bottom: 8px;">
                <div style="padding: 30px 20px; text-align: center; color: color-mix(in srgb, var(--body-text-color, #fff) 60%, transparent); font-size: 14px;">
                    ${t('Loading projects...')}
                </div>
            </div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', projectsModalHTML);
    
    const recoverModalHTML = `
    <div id="ic-recover-modal" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 3100; justify-content: center; align-items: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
        <div class="fluent-panel" style="background: color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent); color: var(--body-text-color, #e0e0e0); padding: 32px; border-radius: 24px; width: 90%; max-width: 400px; display: flex; flex-direction: column; overflow: hidden; backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 1px 1px 0 rgba(255, 255, 255, 0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                    <span>${typeof t === 'function' ? t('Autosave Detected') : 'Autosave Detected'}</span>
                </h2>
            </div>
            
            <div style="font-size: 14px; line-height: 1.5; color: color-mix(in srgb, var(--body-text-color, #fff) 80%, transparent); margin-bottom: 30px;">
                ${typeof t === 'function' ? t('A newer autosave exists for this project. Do you want to recover it?') : 'A newer autosave exists for this project. Do you want to recover it?'}
            </div>
            
            <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button id="ic-recover-btn-no" class="res-preset-btn" style="height: 36px; padding: 0 20px; font-size: 14px; display: flex; align-items: center; justify-content: center;">
                    ${typeof t === 'function' ? t('No, load original') : 'No, load original'}
                </button>
                <button id="ic-recover-btn-yes" class="res-preset-btn primary" style="height: 36px; padding: 0 20px; font-size: 14px; display: flex; align-items: center; justify-content: center;">
                    ${typeof t === 'function' ? t('Yes, recover') : 'Yes, recover'}
                </button>
            </div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', recoverModalHTML);
    
    window.closeProjectsModalWithAnimation = () => {
        const modal = document.getElementById('ic-projects-modal');
        const panel = modal ? modal.querySelector('.fluent-panel') : null;
        const btn = document.getElementById('ic_float_projects');
        if (modal && panel && btn && btn.animate && modal.style.display !== 'none') {
            const btnRect = btn.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const translateX = btnRect.left + btnRect.width/2 - (panelRect.left + panelRect.width/2);
            const translateY = btnRect.top + btnRect.height/2 - (panelRect.top + panelRect.height/2);
            const insetX = Math.max(0, (panelRect.width - btnRect.width) / 2);
            const insetY = Math.max(0, (panelRect.height - btnRect.height) / 2);
            
            const modalAnim = modal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'ease', fill: 'forwards' });
            const anim = panel.animate([
                { transform: 'translate(0, 0)', clipPath: 'inset(0px 0px 0px 0px round 24px)' },
                { transform: `translate(${translateX}px, ${translateY}px)`, clipPath: `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round 50px)` }
            ], { duration: 250, easing: 'cubic-bezier(0.8, 0.2, 0.8, 1)', fill: 'forwards' });
            const opacityAnim = panel.animate([
                { opacity: 1 },
                { opacity: 0 }
            ], { duration: 25, delay: 225, easing: 'linear', fill: 'forwards' });
            anim.onfinish = () => { 
                modal.style.display = 'none'; 
                modalAnim.cancel();
                anim.cancel();
                opacityAnim.cancel();
            };
        } else if (modal) {
            modal.style.display = 'none';
        }
    };

    document.getElementById('ic-projects-close').addEventListener('click', () => {
        window.closeProjectsModalWithAnimation();
    });

    const nodesOverlayHTML = `
    <style>
        #ic-nodes-panel ::-webkit-scrollbar {
            display: none;
        }
        /* Firefox scrollbar support */
        #ic-nodes-panel {
            scrollbar-width: none;
        }

        /* Fluent Design Effects */
        .fluent-card, .res-preset-btn {
            position: relative;
            overflow: hidden;
        }
        .fluent-card::before, .res-preset-btn::before, .ic-menu-action::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: radial-gradient(300px circle at var(--mouse-x, -9999px) var(--mouse-y, -9999px), rgba(255,255,255,0.3), transparent 40%);
            background-color: transparent;
            z-index: 0;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s, background-color 0.3s;
        }
        .fluent-card:hover::before, .res-preset-btn:hover::before, .ic-menu-action:hover::before {
            opacity: 1;
            background-color: rgba(0,0,0,0.015); /* Reduced darken by 0.33x */
        }
        .fluent-card > *, .res-preset-btn > *, .fluent-panel > * {
            position: relative;
            z-index: 1;
        }
        /* Fluent Panel (No Darken) */
        .fluent-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: radial-gradient(400px circle at var(--mouse-x, -9999px) var(--mouse-y, -9999px), rgba(255,255,255,0.2), transparent 40%);
            z-index: 0;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .fluent-panel:hover::before {
            opacity: 1;
        }
        .fluent-card, .res-preset-btn {
            border: none !important;
        }
        .fluent-card::after, .res-preset-btn::after {
            content: '';
            position: absolute;
            inset: 0;
            border: 1px solid transparent;
            border-radius: inherit;
            background: radial-gradient(100px circle at var(--mouse-x, -9999px) var(--mouse-y, -9999px), var(--ic-glow-color, rgba(255,255,255,0.6)), transparent 100%), var(--ic-border-color, var(--border-color-primary, color-mix(in srgb, currentColor 15%, transparent)));
            background-origin: border-box;
            background-clip: border-box;
            -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
            z-index: 10;
        }
        .ic-ripple {
            position: absolute;
            border-radius: 50%;
            transform: scale(1);
            animation: fluent-ripple 0.5s ease-out forwards;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%);
            pointer-events: none;
            width: 120px;
            height: 120px;
            margin-top: -60px;
            margin-left: -60px;
            z-index: 10;
        }
        @keyframes fluent-ripple {
            0% {
                transform: scale(0.6);
                opacity: 1;
            }
            100% {
                transform: scale(1.2);
                opacity: 0;
            }
        }
    </style>
    <div id="ic-nodes-overlay" onclick="if(event.target === this) window.ic_action_toggle_node_manager()" style="position:absolute; top:0; left:0; right:0; bottom:0; z-index:1500; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.4); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); font-family:sans-serif; opacity:0; pointer-events:none; transition:opacity 0.2s;">
        <div id="ic-nodes-wrapper" style="display:flex; flex-direction:row; align-items:center; justify-content:center; height:85%; max-height:800px; transform:scale(0.95); transition:transform 0.2s cubic-bezier(0.4,0,0.2,1); pointer-events:none;">
            <div id="ic-nodes-panel" class="fluent-panel" style="pointer-events:none; cursor:default; display:flex; flex-direction:column; background:color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border:1px solid rgba(255, 255, 255, 0.4); border-radius:24px; box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.2); width:750px; height:100%; overflow:hidden; z-index:1; position:relative;">
                
                <!-- Header -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.1);">
                    <h3 id="ic-sidebar-title" style="margin: 0; font-size: 15px; font-weight: 700; color: var(--body-text-color, #fff);">${typeof t === 'function' ? t('Node Manager') : 'Node Manager'}</h3>
                    <button id="ic-nodes-close-btn" type="button" title="Close" style="flex-shrink: 0; width: 28px; height: 28px; padding: 0; border: 1px solid var(--border-color-primary, rgba(128,128,128,0.2)) !important; border-radius: 8px !important; background: var(--background-fill-secondary, rgba(128,128,128,0.15)) !important; color: var(--body-text-color, #fff) !important; cursor: pointer !important; box-sizing: border-box !important; margin: 0 !important; margin-bottom: 0 !important; box-shadow: none !important; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.1s;" onmousedown="this.style.transform='scale(0.85)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='var(--background-fill-secondary, rgba(128,128,128,0.15))'" onclick="window.ic_action_toggle_node_manager()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <!-- Body -->
                <div style="display:flex; flex-direction:row; flex:1; overflow:hidden;">
                    <!-- Nodes List Column -->
                    <div style="width:260px; padding:20px; display:flex; flex-direction:column; border-right:1px solid rgba(255,255,255,0.1);">
                        <div id="ic-nodes-list-col" style="flex:1; overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; gap:8px;"></div>
                    </div>
                    
                    <!-- Settings Column -->
                    <div style="flex:1; padding:20px; display:flex; flex-direction:column; position:relative;">
                        <div id="ic-nodes-search-wrap" class="fluent-card" style="position:absolute; top:20px; left:20px; right:20px; height:42px; box-sizing:border-box; z-index:10; border-radius:24px; background:rgba(255,255,255,0.6); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid var(--border-color-primary, rgba(128,128,128,0.2)); transition: border-color 0.2s, background 0.2s;">
                            <span style="position:absolute; left:14px; top:50%; transform:translateY(-50%); opacity:0.4; color:var(--body-text-color, white); pointer-events:none; font-size: 18px; display: inline-flex;">${IC_ICONS.search}</span>
                            <input type="text" id="ic-nodes-search" placeholder="${typeof t === 'function' ? t('Search settings...') : 'Search settings...'}" style="width:100%; height:100%; box-sizing:border-box; padding:0 16px 0 40px; margin:0; background:transparent; border:none !important; box-shadow:none !important; color:var(--body-text-color, white); font-size:13px; outline:none; line-height:40px;" onfocus="document.getElementById('ic-nodes-search-wrap').style.borderColor='var(--color-accent, cornflowerblue)';" onblur="document.getElementById('ic-nodes-search-wrap').style.borderColor='var(--border-color-primary, rgba(128,128,128,0.2))';" />
                        </div>
                        <div id="ic-nodes-settings-col" style="flex:1; overflow-y:auto; padding-right:5px;"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', nodesOverlayHTML);

    window.ic_action_toggle_node_manager = function() {
        const overlay = document.getElementById('ic-nodes-overlay');
        const wrapper = document.getElementById('ic-nodes-wrapper');
        const panel = document.getElementById('ic-nodes-panel');
        if (!overlay || !wrapper) return;
        
        if (overlay.style.opacity === '1') {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            if (panel) panel.style.pointerEvents = 'none';
            wrapper.style.transform = 'scale(0.95)';
        } else {
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
            if (panel) panel.style.pointerEvents = 'auto';
            wrapper.style.transform = 'scale(1)';
        }
    };

    document.getElementById('ic-nodes-search').addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase();
        const settingsCol = document.getElementById('ic-nodes-settings-col');
        const groups = settingsCol.querySelectorAll('.ic-plugin-setting-group');
        groups.forEach(group => {
            const text = group.innerText.toLowerCase();
            if (text.includes(query)) {
                group.style.display = 'block';
            } else {
                group.style.display = 'none';
            }
        });
    });

    // Fluent Design & Ripple Effects (Global) - OPTIMIZED
    let lastHoveredCards = new Set();
    let isFluentRafPending = false;
    let latestFluentEvent = { clientX: 0, clientY: 0, path: [] };
    
    document.addEventListener('mousemove', function(e) {
        latestFluentEvent.clientX = e.clientX;
        latestFluentEvent.clientY = e.clientY;
        latestFluentEvent.path = e.composedPath();
        
        if (!isFluentRafPending) {
            isFluentRafPending = true;
            requestAnimationFrame(() => {
                isFluentRafPending = false;
                
                const currentlyHovered = new Set();
                const path = latestFluentEvent.path;
                
                for (let i = 0; i < path.length; i++) {
                    const el = path[i];
                    if (el && el.classList && (el.classList.contains('fluent-card') || el.classList.contains('fluent-panel') || el.classList.contains('res-preset-btn') || el.classList.contains('ic-menu-action') || el.classList.contains('ic-pipeline-node'))) {
                        currentlyHovered.add(el);
                    }
                }
                
                lastHoveredCards.forEach(card => {
                    if (!currentlyHovered.has(card)) {
                        card.style.setProperty('--mouse-x', '-9999px');
                        card.style.setProperty('--mouse-y', '-9999px');
                    }
                });
                
                currentlyHovered.forEach(card => {
                    const rect = card.getBoundingClientRect();
                    const x = latestFluentEvent.clientX - rect.left;
                    const y = latestFluentEvent.clientY - rect.top;
                    card.style.setProperty('--mouse-x', `${x}px`);
                    card.style.setProperty('--mouse-y', `${y}px`);
                });
                
                lastHoveredCards = currentlyHovered;
            });
        }
    }, { passive: true });

    document.addEventListener('mousedown', function(e) {
        // Prevent click effects on the container when interacting with form inputs
        if (e.target.closest('input, select, textarea, .ic-slider-handle')) return;

        const target = e.target.closest('.fluent-card, #ic-nodes-toggle, #ic-nodes-panel button, .ic-pipeline-node, .res-preset-btn');
        if (!target) return;

        // For large plugin cards, only trigger the physical click effect on the header
        if (target.classList.contains('ic-sidebar-plugin-card')) {
            if (!e.target.closest('.ic-sidebar-plugin-header')) return;
        }

        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Asymmetric 3D Tilt Effect
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const percentX = (x - centerX) / (centerX || 1); // -1 to 1
        const percentY = (y - centerY) / (centerY || 1); // -1 to 1
        
        let tiltX = -percentY * 6; // max 6 degrees
        let tiltY = percentX * 6;
        
        // Disable tilt for large setting cards to prevent dramatic clipping/distortion
        if (target.classList.contains('ic-sidebar-plugin-card')) {
            tiltX = 0;
            tiltY = 0;
        }
        
        target.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
        target.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(0.99)`;
        
        const clearTilt = () => {
            target.style.transform = '';
            document.removeEventListener('mouseup', clearTilt);
            target.removeEventListener('mouseleave', clearTilt);
        };
        document.addEventListener('mouseup', clearTilt);
        target.addEventListener('mouseleave', clearTilt);

        // Ripple Effect
        const ripple = document.createElement('span');
        ripple.className = 'ic-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        // Prevent overflow issues on some elements
        if (target.id === 'ic-nodes-toggle') target.style.overflow = 'hidden';

        target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });



    const dynamicModalHTML = `
    <div id="ic_dynamic_modal" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:3000; flex-direction:column; font-family:sans-serif; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
        <div class="fluent-panel" style="max-width:600px; width:100%; padding:24px; border-radius:24px; position:relative; background:color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border:1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.2);">
            <h3 id="ic_dynamic_modal_title" style="margin-top:0; margin-bottom:20px; color:var(--body-text-color, #fff); font-size: 20px;">${t('Dialog')}</h3>
            <div id="ic_dynamic_modal_content"></div>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', dynamicModalHTML);

    window.ic_alert = function(message, title="Alert") {
        return new Promise((resolve) => {
            const modal = document.getElementById('ic_dynamic_modal');
            const modalTitle = document.getElementById('ic_dynamic_modal_title');
            const modalContent = document.getElementById('ic_dynamic_modal_content');
            if(modalTitle) modalTitle.innerText = typeof t === 'function' ? t(title) : title;
            if(modalContent) modalContent.innerHTML = `
                <div style="color: var(--body-text-color, #fff); font-size: 15px; margin-bottom: 24px; line-height: 1.5; white-space: pre-wrap;">${message}</div>
                <div style="display: flex; justify-content: flex-end;">
                    <button id="ic_alert_ok" class="res-preset-btn primary" style="padding: 8px 24px; font-weight: bold; border: none; background: #2563eb !important; color: #fff !important;">${typeof t === 'function' ? t('OK') : 'OK'}</button>
                </div>
            `;
            if(modal) modal.style.display = 'flex';
            const okBtn = document.getElementById('ic_alert_ok');
            if(okBtn) okBtn.onclick = () => {
                if(modal) modal.style.display = 'none';
                resolve();
            };
        });
    };

    window.ic_confirm = function(message, title="Confirm") {
        return new Promise((resolve) => {
            const modal = document.getElementById('ic_dynamic_modal');
            const modalTitle = document.getElementById('ic_dynamic_modal_title');
            const modalContent = document.getElementById('ic_dynamic_modal_content');
            if(modalTitle) modalTitle.innerText = typeof t === 'function' ? t(title) : title;
            if(modalContent) modalContent.innerHTML = `
                <div style="color: var(--body-text-color, #fff); font-size: 15px; margin-bottom: 24px; line-height: 1.5; white-space: pre-wrap;">${message}</div>
                <div style="display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="ic_confirm_cancel" class="res-preset-btn" style="padding: 8px 24px; font-weight: bold; border: 1px solid rgba(128,128,128,0.3); background: transparent !important; color: var(--body-text-color, #fff) !important;">${typeof t === 'function' ? t('Cancel') : 'Cancel'}</button>
                    <button id="ic_confirm_ok" class="res-preset-btn primary" style="padding: 8px 24px; font-weight: bold; border: none; background: #2563eb !important; color: #fff !important;">${typeof t === 'function' ? t('OK') : 'OK'}</button>
                </div>
            `;
            if(modal) modal.style.display = 'flex';
            const cancelBtn = document.getElementById('ic_confirm_cancel');
            if(cancelBtn) cancelBtn.onclick = () => {
                if(modal) modal.style.display = 'none';
                resolve(false);
            };
            const okBtn = document.getElementById('ic_confirm_ok');
            if(okBtn) okBtn.onclick = () => {
                if(modal) modal.style.display = 'none';
                resolve(true);
            };
        });
    };

    // --- MENU BAR INJECTION ---
    const menuBarHTML = `
    <div id="ic-menu-bar" class="fluent-panel" style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 36px;
        z-index: 2500;
        display: flex;
        align-items: center;
        padding: 0 16px;
        font-size: 13px;
        gap: 4px;
        user-select: none;
    " onwheel="event.stopPropagation()">
        <div style="
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.4);
            box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.2);
            z-index: -1;
            pointer-events: none;
        "></div>
        <div class="ic-menu-item-group">
            <div class="ic-menu-item-label">${typeof t === 'function' ? t('File') : 'File'}</div>
            <div class="ic-menu-dropdown">
                <div class="ic-menu-action" onclick="window.ic_action_new_project()">${typeof t === 'function' ? t('New Project') : 'New Project'}</div>
                <div class="ic-menu-action ic-has-submenu" onmouseenter="window.ic_populate_menu_projects()">
                    ${typeof t === 'function' ? t('Load Project') : 'Load Project'}
                    <span style="margin-left:auto; opacity:0.5; font-size:18px; display:inline-flex; align-items:center;">${IC_ICONS.chevron_right}</span>
                    <div class="ic-submenu">
                        <div class="ic-submenu-content" id="ic-menu-projects-list">
                            <div style="padding: 8px 12px; color: #888;">${typeof t === 'function' ? t('Loading...') : 'Loading...'}</div>
                        </div>
                    </div>
                </div>
                <div class="ic-menu-action" onclick="document.getElementById('ic-projects-save-btn')?.click()">${typeof t === 'function' ? t('Save Project') : 'Save Project'}</div>
                <div class="ic-menu-action" id="ic-menu-autosave-item" onclick="if(window.ic_action_toggle_autosave) window.ic_action_toggle_autosave()" style="display: flex; align-items: center;">
                    <span id="ic-menu-autosave-check" style="margin-right: 6px; display: none; font-size: 16px;"></span>
                    ${typeof t === 'function' ? t('Autosave') : 'Autosave'}
                </div>
                <div class="ic-menu-divider"></div>
                <div class="ic-menu-action ic-has-submenu">
                    ${typeof t === 'function' ? t('Upload Base Image') : 'Upload Base Image'}
                    <span style="margin-left:auto; opacity:0.5; font-size:18px; display:inline-flex; align-items:center;">${IC_ICONS.chevron_right}</span>
                    <div class="ic-submenu">
                        <div class="ic-submenu-content">
                            <div class="ic-menu-action" onclick="window.ic_action_paste()">${typeof t === 'function' ? t('From Clipboard') : 'From Clipboard'}</div>
                            <div class="ic-menu-action" onclick="window.ic_action_upload()">${typeof t === 'function' ? t('From Local') : 'From Local'}</div>
                        </div>
                    </div>
                </div>
                <div class="ic-menu-action" onclick="window.ic_action_download()">${typeof t === 'function' ? t('Download Canvas') : 'Download Canvas'}</div>
            </div>
        </div>
        <div class="ic-menu-item-group">
            <div class="ic-menu-item-label">${typeof t === 'function' ? t('Edit') : 'Edit'}</div>
            <div class="ic-menu-dropdown">
                <div class="ic-menu-action" id="ic_menu_undo" onclick="window.ic_action_undo()"><span style="margin-right:8px;">${IC_ICONS.undo}</span>${typeof t === 'function' ? t('Undo Canvas') : 'Undo Canvas'}</div>
                <div class="ic-menu-action" id="ic_menu_redo" onclick="window.ic_action_redo()"><span style="margin-right:8px;">${IC_ICONS.redo}</span>${typeof t === 'function' ? t('Redo Canvas') : 'Redo Canvas'}</div>
                <div class="ic-menu-divider"></div>
                <div class="ic-menu-action" id="ic_menu_mask_undo"><span style="margin-right:8px;">${IC_ICONS.undo}</span>${typeof t === 'function' ? t('Undo Mask') : 'Undo Mask'}<span class="ic-menu-shortcut">Ctrl+Z</span></div>
                <div class="ic-menu-action" id="ic_menu_mask_redo"><span style="margin-right:8px;">${IC_ICONS.redo}</span>${typeof t === 'function' ? t('Redo Mask') : 'Redo Mask'}<span class="ic-menu-shortcut">Ctrl+Y</span></div>
                <div class="ic-menu-divider"></div>
                <div class="ic-menu-action" onclick="window.ic_action_copy()">${typeof t === 'function' ? t('Copy Canvas') : 'Copy Canvas'}</div>
                <div class="ic-menu-action" onclick="window.ic_action_reset()">${typeof t === 'function' ? t('Reset Canvas') : 'Reset Canvas'}</div>
                <div class="ic-menu-action" onclick="window.ic_action_clear_mask()">${typeof t === 'function' ? t('Clear Mask') : 'Clear Mask'}</div>
                <div class="ic-menu-divider"></div>
                <div class="ic-menu-action" onclick="if(window.ic_autoCrop) window.ic_autoCrop('black')">${typeof t === 'function' ? t('Crop Pure Black') : 'Crop Pure Black'}</div>
                <div class="ic-menu-action" onclick="if(window.ic_autoCrop) window.ic_autoCrop('white')">${typeof t === 'function' ? t('Crop Pure White') : 'Crop Pure White'}</div>
            </div>
        </div>
        <div class="ic-menu-item-group">
            <div class="ic-menu-item-label">${typeof t === 'function' ? t('View') : 'View'}</div>
            <div class="ic-menu-dropdown">
                <div class="ic-menu-action" id="ic-menu-overlay-item" onclick="window.ic_action_toggle_overlay()" style="display: flex; align-items: center;">
                    <span id="ic-menu-overlay-check" style="margin-right: 6px; display: inline-flex; font-size: 16px;">${IC_ICONS.check}</span>
                    ${typeof t === 'function' ? t('Show Overlays') : 'Show Overlays'}
                </div>
                <div class="ic-menu-divider"></div>
                <div class="ic-menu-action" onclick="window.ic_action_toggle_fullscreen()">${typeof t === 'function' ? t('Fullscreen') : 'Fullscreen'}</div>
                <div class="ic-menu-action" onclick="window.ic_action_open_standalone()">${typeof t === 'function' ? t('Open in New Window') : 'Open in New Window'}</div>
            </div>
        </div>
        <div class="ic-menu-item-group">
            <div class="ic-menu-item-label">${typeof t === 'function' ? t('Window') : 'Window'}</div>
            <div class="ic-menu-dropdown">
                <div class="ic-menu-action" onclick="window.ic_action_toggle_node_manager()" style="display:flex; align-items:center;">
                    ${typeof t === 'function' ? t('Open Node Manager') : 'Open Node Manager'}
                    <span class="ic-menu-shortcut">Ctrl+P</span>
                </div>
            </div>
        </div>
        <div class="ic-menu-item-group">
            <div class="ic-menu-item-label">${typeof t === 'function' ? t('About') : 'About'}</div>
            <div class="ic-menu-dropdown">
                <div class="ic-menu-action" style="cursor: default; pointer-events: none; opacity: 0.7;">Infinite Canvas</div>
            </div>
        </div>
        <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
            <div id="ic-menu-project-name-display" style="cursor: text; padding: 4px 8px; border-radius: 6px; transition: background 0.2s; color: var(--body-text-color, #fff); font-weight: 600;" title="Double click to edit project name" ondblclick="window.ic_action_edit_project_name()">project</div>
            <input id="ic-menu-project-name-input" type="text" style="display: none; height: 26px; padding: 0 8px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; outline: none; font-size: 13px; width: 140px; font-weight: 600;" onblur="window.ic_action_save_project_name()" onkeydown="if(event.key === 'Enter') this.blur();">
        </div>
    </div>
    <style>
        .ic-menu-item-group {
            position: relative;
            height: 100%;
            display: flex;
            align-items: center;
            z-index: auto !important;
        }
        .ic-menu-item-label {
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 8px;
            transition: background 0.2s;
            color: var(--body-text-color, #fff);
            display: flex;
            align-items: center;
            line-height: 1;
        }
        .ic-menu-item-group:hover .ic-menu-item-label,
        .ic-menu-item-group.ic-menu-open .ic-menu-item-label {
            background: color-mix(in srgb, currentColor 10%, transparent);
        }
        .ic-menu-dropdown::before,
        .ic-submenu::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), inset 1px 1px 0 rgba(255, 255, 255, 0.2);
            z-index: -1;
            pointer-events: none;
        }
        .ic-menu-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            min-width: 200px;
            border-radius: 16px;
            padding: 4px;
            display: none;
            flex-direction: column;
            z-index: 3000;
        }
        /* Open/close is JS-controlled (12_menu.js via Floating UI).
           This CSS-hover rule only applies as a fallback when the lib fails to load. */
        .ic-menu-css-fallback .ic-menu-item-group:hover .ic-menu-dropdown {
            display: flex;
        }
        .ic-menu-action {
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 12px;
            display: flex;
            align-items: center;
            color: var(--body-text-color, #fff);
            transition: all 0.15s;
            position: relative;
        }
        .ic-menu-action:hover {
            background: cornflowerblue !important;
            color: white !important;
            --ic-border-color: color-mix(in srgb, cornflowerblue 70%, black);
            --ic-glow-color: rgba(255, 255, 255, 0.8);
        }
        .ic-menu-action:hover svg,
        .ic-menu-action:hover svg path,
        .ic-menu-action:hover span {
            fill: white !important;
            color: white !important;
        }
        .ic-menu-shortcut {
            margin-left: auto;
            opacity: 0.5;
            font-size: 12px;
        }
        .ic-menu-divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.1);
            margin: 4px 0;
        }
        .ic-has-submenu { position: relative; }
        .ic-submenu {
            position: absolute;
            left: 100%;
            top: 0;
            min-width: 180px;
            border-radius: 16px;
            padding: 4px;
            display: none;
            flex-direction: column;
            margin-left: -4px;
            z-index: 5002;
        }
        .ic-submenu-content {
            display: flex;
            flex-direction: column;
            max-height: 400px;
            overflow-y: auto;
        }
        .ic-menu-css-fallback .ic-has-submenu:hover .ic-submenu { display: flex; }
    </style>
    `;
    container.insertAdjacentHTML('beforeend', menuBarHTML);

    // --- FLOATING TOOLBAR INJECTION ---
    const floatingToolbarHTML = `
    <div id="ic-floating-toolbar" class="fluent-panel" style="
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: color-mix(in srgb, color-mix(in srgb, var(--body-background-fill, #1e1e1e) 95%, #000) 85%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 12px;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), inset 1px 1px 0 rgba(255, 255, 255, 0.2);
        z-index: 1000;
        pointer-events: auto;
        user-select: none;
        cursor: default;
        width: max-content;
        max-width: 95%;
    ">
        <div style="display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px;">
            <!-- Fast Res Button -->
            <button id="ic_float_res_btn" class="res-preset-btn" style="padding: 0 12px; width: auto; font-size: 14px; font-weight: bold;" title="${typeof t === 'function' ? t('Resolution Preset') : 'Resolution Preset'}">
                <span style="font-size: 18px; margin-right: 6px; display: inline-flex; vertical-align: middle;">${IC_ICONS.photo_size_select_large || IC_ICONS.rectangle || '📏'}</span>
                ${typeof t === 'function' ? t('Resolution') : 'Resolution'}
            </button>

            <div style="min-width: 1px; height: 24px; background: rgba(0,0,0,0.1); margin: 0 4px;"></div>

            <!-- Tools -->
            <button id="ic_float_rect" class="res-preset-btn primary float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Rect')}"><span style="font-size: 20px; vertical-align: middle; display: inline-flex;">${IC_ICONS.rectangle}</span></button>
            <button id="ic_float_brush" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Brush')}"><span style="font-size: 20px; vertical-align: middle; display: inline-flex;">${IC_ICONS.brush}</span></button>
            <button id="ic_float_ellipse" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Ellipse')}"><span style="font-size: 20px; vertical-align: middle; display: inline-flex;">${IC_ICONS.circle}</span></button>
            <button id="ic_float_eraser" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('Eraser')}"><span style="font-size: 20px; vertical-align: middle; display: inline-flex;">${IC_ICONS.ink_eraser}</span></button>
            <button id="ic_float_magic" class="res-preset-btn float-tool-btn" style="padding: 0 12px; width: auto; font-size: 16px;" title="${t('🪄 Magic Wand')} \n${t('Click inside the blue box to auto-segment')}"><span style="font-size: 20px; vertical-align: middle; display: inline-flex;">${IC_ICONS.auto_fix_high}</span></button>
            
            <div style="min-width: 1px; height: 24px; background: rgba(0,0,0,0.1); margin: 0 4px;"></div>

            <!-- Auto Scale -->
            <button id="ic_float_autoscale" class="res-preset-btn primary" style="padding: 0 12px; width: auto; font-size: 13px;">${t('Auto Scale Canvas')}</button>
            
            <div style="min-width: 1px; height: 24px; background: rgba(0,0,0,0.1); margin: 0 4px;"></div>

            <button id="ic-sidebar-generate-btn" class="res-preset-btn primary" style="height: 40px; min-width: 120px; padding: 0 24px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 12px rgba(100, 149, 237, 0.4);">${t('Generate')}</button>
            <button id="ic-sidebar-interrupt-btn" class="res-preset-btn" style="display: none; height: 40px; min-width: 120px; padding: 0 24px; font-size: 15px; font-weight: 700; background: #e53e3e !important; color: white !important; box-shadow: 0 4px 12px rgba(229, 62, 62, 0.4) !important;">${t('Interrupt')}</button>
            <input type="file" id="ic_float_upload_input" accept=".png,.jpg,.jpeg,.webp" style="display: none;" />
        </div>
        
        <!-- Floating Popup for Brush Size -->
        <div id="ic_brush_slider_popup" style="opacity: 0; pointer-events: none; position: absolute; top: -55px; left: 50%; transform: translateX(-50%) translateY(10px) scale(0.95); transition: opacity 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 5px; align-items: center; z-index: 1001;">
            <div style="font-size: 11px; color: #555; font-weight: bold; margin-bottom: 2px;">${typeof t === 'function' ? t('Brush Size') : 'Brush Size'}: <span id="ic_float_brush_size_val" style="font-family: monospace; color: #111; font-size: 13px;">10</span></div>
            <input type="range" id="ic_float_brush_size" min="0" max="100" value="10" style="width: 120px; cursor: pointer; margin: 0;">
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid rgba(255, 255, 255, 0.95);"></div>
        </div>
    </div>

    
    <!-- Floating Popup for Resolution Presets -->
    <div id="ic_res_popup" style="opacity: 0; pointer-events: none; position: absolute; bottom: 85px; left: 50%; transform: translateX(-50%) translateY(10px) scale(0.95); transition: opacity 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); padding: 12px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 8px; z-index: 1001; min-width: 180px;">
        <div style="font-size: 13px; font-weight: bold; color: #555; text-align: center; padding-bottom: 6px; border-bottom: 1px solid rgba(0,0,0,0.1); margin-bottom: 4px;">${typeof t === 'function' ? t('Resolution Preset') : 'Resolution Preset'}</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(1024,1024); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 16px; height: 16px;"></div></div> 1024 × 1024 <span style="opacity:0.5; margin-left:auto; font-size:11px;">1:1</span></div>
            
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(832,1216); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 11px; height: 16px;"></div></div> 832 × 1216 <span style="opacity:0.5; margin-left:auto; font-size:11px;">2:3</span></div>
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(768,1344); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 9px; height: 16px;"></div></div> 768 × 1344 <span style="opacity:0.5; margin-left:auto; font-size:11px;">9:16</span></div>
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(640,1632); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 6px; height: 16px;"></div></div> 640 × 1632 <span style="opacity:0.5; margin-left:auto; font-size:11px;">2:5</span></div>
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(512,2048); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 4px; height: 16px;"></div></div> 512 × 2048 <span style="opacity:0.5; margin-left:auto; font-size:11px;">1:4</span></div>
            
            <div style="height:1px; background:rgba(0,0,0,0.05); margin: 2px 0;"></div>
            
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(1216,832); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 16px; height: 11px;"></div></div> 1216 × 832 <span style="opacity:0.5; margin-left:auto; font-size:11px;">3:2</span></div>
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(1344,768); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 16px; height: 9px;"></div></div> 1344 × 768 <span style="opacity:0.5; margin-left:auto; font-size:11px;">16:9</span></div>
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(1632,640); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 16px; height: 6px;"></div></div> 1632 × 640 <span style="opacity:0.5; margin-left:auto; font-size:11px;">5:2</span></div>
            <div class="res-preset-btn" style="width: 100%; height: 32px; padding: 0 12px; font-size: 13px; justify-content: flex-start;" onclick="ic_setRes(2048,512); document.getElementById('ic_res_popup').style.opacity='0'; document.getElementById('ic_res_popup').style.pointerEvents='none';"><div style="width:24px;display:flex;justify-content:center;margin-right:8px;"><div class="res-preset-icon" style="width: 16px; height: 4px;"></div></div> 2048 × 512 <span style="opacity:0.5; margin-left:auto; font-size:11px;">4:1</span></div>
        </div>
        <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid rgba(255, 255, 255, 0.95);"></div>
    </div>

    <!-- Floating Popup for Auto Crop -->
    <div id="ic_crop_popup" style="opacity: 0; pointer-events: none; position: absolute; bottom: 85px; left: 50%; transform: translateX(-50%) translateY(10px) scale(0.95); transition: opacity 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 4px 15px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 5px; z-index: 1001;">
        <button id="ic_crop_black" class="res-preset-btn" style="padding: 6px 12px; font-size: 13px; background: #000 !important; color: #fff !important; width: 100%; justify-content: center;">${typeof t === 'function' ? t('Crop Pure Black') : 'Crop Pure Black'}</button>
        <button id="ic_crop_white" class="res-preset-btn" style="padding: 6px 12px; font-size: 13px; background: #fff !important; color: #000 !important; border: 1px solid #ccc !important; width: 100%; justify-content: center;">${typeof t === 'function' ? t('Crop Pure White') : 'Crop Pure White'}</button>
        <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid rgba(255, 255, 255, 0.95);"></div>
    </div>

    <style>
    .res-preset-btn {
        background: #ffffff !important;
        color: #333333 !important;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 36px;
        min-width: 36px;
        padding: 0 8px;
        font-family: sans-serif;
        font-weight: 500;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02) !important;
        box-sizing: border-box !important;
        margin: 0;
        margin-bottom: 0 !important;
        white-space: nowrap;
        line-height: 1;
    }
    .res-preset-btn:hover {
        background: #f2f2f2 !important;
    }
    .res-preset-btn.primary {
        background: cornflowerblue !important;
        color: white !important;
        --ic-border-color: color-mix(in srgb, cornflowerblue 70%, black);
        --ic-glow-color: rgba(255, 255, 255, 0.8);
        box-shadow: 0 2px 6px rgba(100, 149, 237, 0.3) !important;
    }
    .res-preset-btn.primary svg, .res-preset-btn.primary svg path {
        fill: white !important;
        color: white !important;
    }
    .res-preset-btn.primary:hover {
        background: #5a85de !important;
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
        .res-preset-btn.disabled-state, .ic-menu-action.disabled-state {
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
            const m3 = document.getElementById('ic-guide-modal');
            
            const isAnyModalOpen = (m1 && m1.style.display !== 'none') || 
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
        window.ic_action_undo = async function() {
            if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t("Undoing...") : "Undoing...", 0, 'white', 'ic-save-toast');
            try {
                const res = await fetch('/infinite-canvas-api/canvas/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: 'prev' })
                });
                const data = await res.json();
                if (window.ic_handle_payload) window.ic_handle_payload(data);
            } catch (e) {
                console.error("Undo failed", e);
            } finally {
                if (typeof icHideToast === 'function') icHideToast('ic-save-toast');
            }
        };
        document.getElementById('ic_float_undo')?.addEventListener('click', window.ic_action_undo);

        window.ic_action_redo = async function() {
            if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t("Redoing...") : "Redoing...", 0, 'white', 'ic-save-toast');
            try {
                const res = await fetch('/infinite-canvas-api/canvas/toggle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ state: 'now' })
                });
                const data = await res.json();
                if (window.ic_handle_payload) window.ic_handle_payload(data);
            } catch (e) {
                console.error("Redo failed", e);
            } finally {
                if (typeof icHideToast === 'function') icHideToast('ic-save-toast');
            }
        };
        document.getElementById('ic_float_redo')?.addEventListener('click', window.ic_action_redo);

        // Mask Undo / Redo
        document.getElementById('ic_float_mask_undo')?.addEventListener('click', undoMask);
        document.getElementById('ic_float_mask_redo')?.addEventListener('click', redoMask);
        document.getElementById('ic_menu_mask_undo')?.addEventListener('click', undoMask);
        document.getElementById('ic_menu_mask_redo')?.addEventListener('click', redoMask);

        // Keyboard shortcuts for mask undo/redo: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
        // Also track backtick (`) for debug info
        window.ic_show_debug_info = false;
        document.addEventListener('keydown', (e) => {
            // Only handle when the canvas container is visible and no modal/input is focused
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
            if (e.key === '`') {
                if (!window.ic_show_debug_info) {
                    window.ic_show_debug_info = true;
                    if (typeof draw === 'function') draw();
                }
            }
            if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (window.ic_action_toggle_node_manager) window.ic_action_toggle_node_manager();
            } else if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                undoMask();
            } else if ((e.ctrlKey && e.shiftKey && (e.key === 'Z' || e.key === 'z')) || (e.ctrlKey && e.key === 'y')) {
                e.preventDefault();
                redoMask();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === '`') {
                window.ic_show_debug_info = false;
                if (typeof draw === 'function') draw();
            }
        });
        
        window.ic_update_canvas_undo_redo = function(canUndo, canRedo) {
            const setDisabled = (ids, isDisabled) => {
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.disabled = isDisabled;
                    if (isDisabled) el.classList.add('disabled-state');
                    else el.classList.remove('disabled-state');
                });
            };
            setDisabled(['ic_float_undo', 'ic_menu_undo'], !canUndo);
            setDisabled(['ic_float_redo', 'ic_menu_redo'], !canRedo);
        };
        // Initial state is false
        window.ic_update_canvas_undo_redo(false, false);
        
        const floatOverlayBtn = document.getElementById('ic_float_overlay');
        window.ic_action_toggle_overlay = function() {
            window.ic_show_overlay_state = !window.ic_show_overlay_state;
            
            const overlayCb = document.querySelector('#ic_show_overlay input[type="checkbox"]');
            if(overlayCb && overlayCb.checked !== window.ic_show_overlay_state) overlayCb.click();
            
            if (floatOverlayBtn) {
                if (window.ic_show_overlay_state) floatOverlayBtn.classList.add('primary');
                else floatOverlayBtn.classList.remove('primary');
            }
            
            const menuCheck = document.getElementById('ic-menu-overlay-check');
            if (menuCheck) {
                if (window.ic_show_overlay_state) {
                    menuCheck.innerHTML = IC_ICONS.check;
                    menuCheck.style.display = 'inline-flex';
                } else {
                    menuCheck.innerHTML = '';
                    menuCheck.style.display = 'none';
                }
            }
            
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
        };

        if (floatOverlayBtn) {
            floatOverlayBtn.addEventListener('click', window.ic_action_toggle_overlay);
        }
        const floatAutoScaleBtn = document.getElementById('ic_float_autoscale');
        window.ic_action_toggle_autoscale = function() {
            window.ic_auto_scale_state = !window.ic_auto_scale_state;
            
            const autoScaleCb = document.querySelector('input.ic-node-param[data-node-id="parse_input"][data-param-name="auto_scale"]');
            if(autoScaleCb && autoScaleCb.checked !== window.ic_auto_scale_state) autoScaleCb.click();
            
            if (floatAutoScaleBtn) {
                if (window.ic_auto_scale_state) floatAutoScaleBtn.classList.add('primary');
                else floatAutoScaleBtn.classList.remove('primary');
            }
            
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
        };

        if (floatAutoScaleBtn) {
            floatAutoScaleBtn.addEventListener('click', window.ic_action_toggle_autoscale);
        }
        
        // Actions
        window.ic_get_project_name = function() {
            const input = document.getElementById('ic-projects-name-input');
            return input ? input.value.trim() : 'project';
        };

        window.ic_set_project_name = function(name) {
            name = name.trim() || 'project';
            const oldInput = document.getElementById('ic-projects-name-input');
            if (oldInput && oldInput.value !== name) oldInput.value = name;
            
            const display = document.getElementById('ic-menu-project-name-display');
            if (display) display.innerText = name;
        };

        window.ic_action_edit_project_name = function() {
            const display = document.getElementById('ic-menu-project-name-display');
            const input = document.getElementById('ic-menu-project-name-input');
            if (!display || !input) return;
            
            display.style.display = 'none';
            input.style.display = 'block';
            input.value = window.ic_get_project_name();
            input.focus();
            input.select();
        };

        window.ic_action_save_project_name = function() {
            const display = document.getElementById('ic-menu-project-name-display');
            const input = document.getElementById('ic-menu-project-name-input');
            if (!display || !input) return;
            
            const originalName = window.ic_get_project_name();
            const newName = input.value.trim() || 'project';
            
            window.ic_set_project_name(newName);
            input.style.display = 'none';
            display.style.display = 'block';

            if (originalName !== newName && window.ic_trigger_save_project) {
                window.ic_trigger_save_project();
            }
        };

        window.ic_action_new_project = async function() {
            if (await window.ic_confirm(typeof t === 'function' ? t("Are you sure you want to start a new project? All unsaved changes will be lost.") : "Are you sure you want to start a new project? All unsaved changes will be lost.")) {
                const defaultName = typeof t === 'function' ? t('project') : 'project';
                const promptMsg = typeof t === 'function' ? t("Enter new project name:") : "Enter new project name:";
                let newName = prompt(promptMsg, defaultName);
                if (newName === null) return; // User cancelled
                
                window.ic_set_project_name(newName.trim() || defaultName);
                fetch('/infinite-canvas-api/canvas/reset', { method: 'POST' })
                    .then(res => res.json())
                    .then(data => {
                        if (window.ic_handle_payload) window.ic_handle_payload(data);
                    }).catch(e => console.error("New project failed", e));
            }
        };

        window.ic_update_autosave_ui = function() {
            const autosaveBtn = document.getElementById('ic_float_autosave');
            if (autosaveBtn) {
                if (window.ic_autosave_enabled) autosaveBtn.classList.add('primary');
                else autosaveBtn.classList.remove('primary');
            }
            const menuCheck = document.getElementById('ic-menu-autosave-check');
            if (menuCheck) {
                if (window.ic_autosave_enabled) {
                    menuCheck.innerHTML = IC_ICONS.check;
                    menuCheck.style.display = 'inline-flex';
                } else {
                    menuCheck.innerHTML = '';
                    menuCheck.style.display = 'none';
                }
            }
        };

        window.ic_action_toggle_autosave = async function() {
            window.ic_autosave_enabled = !window.ic_autosave_enabled;
            window.ic_update_autosave_ui();
            try {
                await fetch('/infinite-canvas-api/projects/set_autosave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: window.ic_autosave_enabled })
                });
            } catch(e) { console.error("Set autosave failed", e); }
        };

        window.ic_populate_menu_projects = async function() {
            const listContainer = document.getElementById('ic-menu-projects-list');
            if (!listContainer || listContainer.getAttribute('data-loaded')) return;
            
            try {
                const res = await fetch('/infinite-canvas-api/projects/list');
                const projects = await res.json();
                
                listContainer.innerHTML = '';
                delete listContainer.dataset.icHasScrollbar;
                if (projects.length === 0) {
                    listContainer.innerHTML = `<div style="padding: 8px 12px; color: color-mix(in srgb, var(--body-text-color, #fff) 60%, transparent); font-size: 13px;">${typeof t === 'function' ? t('No projects found.') : 'No projects found.'}</div>`;
                    listContainer.setAttribute('data-loaded', 'true');
                    return;
                }
                
                projects.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'ic-menu-action';
                    item.innerText = p.name;
                    item.addEventListener('click', async (e) => {
                        e.stopPropagation(); // prevent parent clicks
                        if (window.ic_is_loading_or_saving) return;
                        window.lockProjectUI();
                        if (window.ic_set_project_name) window.ic_set_project_name(p.name);
                        
                        try {
                            const chkRes = await fetch('/infinite-canvas-api/projects/check_autosave', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ project_name: p.name })
                            });
                            const chkData = await chkRes.json();
                            
                            const doLoad = async (recover) => {
                                try {
                                    const loadRes = await fetch('/infinite-canvas-api/projects/load', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ project_name: p.name, recover_autosave: recover })
                                    });
                                    const loadData = await loadRes.json();
                                    if (window.ic_handle_payload) window.ic_handle_payload(loadData);
                                } catch (err) {
                                    console.error("Load project error", err);
                                } finally {
                                    if (window.unlockProjectUI) window.unlockProjectUI();
                                }
                            };
                            
                            if (chkData.has_newer) {
                                const recoverModal = document.getElementById('ic-recover-modal');
                                if (recoverModal) recoverModal.style.display = 'flex';
                                window._ic_recover_callback = doLoad;
                            } else {
                                await doLoad(false);
                            }
                        } catch (err) {
                            console.error("Check autosave error", err);
                            if (window.unlockProjectUI) window.unlockProjectUI();
                        }
                    });
                    listContainer.appendChild(item);
                });
                listContainer.setAttribute('data-loaded', 'true');
                if (window.ic_init_custom_scrollbar) {
                    window.ic_init_custom_scrollbar(listContainer);
                }
            } catch (err) {
                console.error("Failed to fetch projects for menu", err);
                listContainer.innerHTML = `<div style="padding: 8px 12px; color: #e53e3e; font-size: 13px;">${typeof t === 'function' ? t('Load failed') : 'Load failed'}</div>`;
            }
        };

        function clickGradioBtn(id) {
            let btn = document.getElementById(id);
            if (!btn) return;
            if (btn.tagName !== 'BUTTON') {
                const inner = btn.querySelector('button');
                if (inner) btn = inner;
            }
            btn.click();
        }
        window.ic_action_clear_mask = async function() {
            if (await window.ic_confirm(typeof t === 'function' ? t("Are you sure you want to clear the mask?") : "Are you sure you want to clear the mask?")) {
                if (typeof clearMask === 'function') clearMask();
                if (typeof draw === 'function') draw();
            }
        };
        document.getElementById('ic_float_clear')?.addEventListener('click', window.ic_action_clear_mask);

        window.ic_action_reset = async function() {
            if (await window.ic_confirm(typeof t === 'function' ? t("Are you sure you want to reset the entire canvas?") : "Are you sure you want to reset the entire canvas?")) {
                try {
                    const res = await fetch('/infinite-canvas-api/canvas/reset', { method: 'POST' });
                    const data = await res.json();
                    if (window.ic_handle_payload) window.ic_handle_payload(data);
                } catch (e) { console.error("Reset failed", e); }
            }
        };
        document.getElementById('ic_float_reset')?.addEventListener('click', window.ic_action_reset);

        window.ic_action_download = function() {
            if (window.ic_tiles && Object.keys(window.ic_tiles).length > 0) {
                const nameField = document.getElementById('ic-projects-name-input');
                const projName = (nameField && nameField.value.trim() !== '') ? encodeURIComponent(nameField.value.trim()) : 'canvas';
                const url = `/infinite-canvas-api/download?name=${projName}`;
                
                const a = document.createElement('a');
                a.href = url;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        };
        document.getElementById('ic_float_download')?.addEventListener('click', window.ic_action_download);
        const floatCopyBtn = document.getElementById('ic_float_copy');
        window.ic_action_copy = function() {
            if (window.ic_tiles && Object.keys(window.ic_tiles).length > 0) {
                const originalText = floatCopyBtn ? floatCopyBtn.innerText : "Copy Canvas";
                if (floatCopyBtn) floatCopyBtn.innerText = "Copying...";
                fetch('/infinite-canvas-api/download')
                    .then(res => res.blob())
                    .then(blob => {
                        if (blob) {
                            const item = new ClipboardItem({ 'image/png': blob });
                            navigator.clipboard.write([item]).then(() => {
                                if (floatCopyBtn) floatCopyBtn.innerText = typeof t === 'function' ? t('Copied!') : 'Copied!';
                                if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t('Copied to clipboard!') : 'Copied to clipboard!', 2000, 140);
                                setTimeout(() => {
                                    if (floatCopyBtn) floatCopyBtn.innerText = originalText;
                                }, 2000);
                            }).catch(e => {
                                console.error('Copy failed:', e);
                                if (floatCopyBtn) floatCopyBtn.innerText = originalText;
                            });
                        }
                    }).catch(e => {
                        console.error('Fetch failed:', e);
                        if (floatCopyBtn) floatCopyBtn.innerText = originalText;
                    });
            }
        };

        if (floatCopyBtn) {
            floatCopyBtn.addEventListener('click', window.ic_action_copy);
        }
        const floatUploadBtn = document.getElementById('ic_float_upload');
        const floatUploadInput = document.getElementById('ic_float_upload_input');
        window.ic_action_upload = function() {
            if (floatUploadInput) floatUploadInput.click();
        };

        if (floatUploadBtn) {
            floatUploadBtn.addEventListener('click', window.ic_action_upload);
        }
        if (floatUploadInput) {
            floatUploadInput.addEventListener('change', async (e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                const file = e.target.files[0];
                if (window.lockProjectUI) window.lockProjectUI();
                if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t("Uploading image...") : "Uploading image...", 0, 'white', 'ic-save-toast');
                
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const res = await fetch('/infinite-canvas-api/upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ image_b64: event.target.result })
                        });
                        const data = await res.json();
                        if (window.ic_handle_payload) window.ic_handle_payload(data);
                    } catch (err) {
                        console.error("Upload failed:", err);
                    } finally {
                        if (window.unlockProjectUI) window.unlockProjectUI();
                        if (typeof icHideToast === 'function') icHideToast('ic-save-toast');
                        floatUploadInput.value = ''; // Reset input
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        
        window.ic_action_paste = async function() {
            try {
                if (!navigator.clipboard) {
                    window.ic_alert(typeof t === 'function' ? t('Clipboard API not supported in your browser.') : 'Clipboard API not supported in your browser.');
                    return;
                }
                const clipboardItems = await navigator.clipboard.read();
                for (const clipboardItem of clipboardItems) {
                    const imageTypes = clipboardItem.types.filter(type => type.startsWith('image/'));
                    for (const imageType of imageTypes) {
                        const blob = await clipboardItem.getType(imageType);
                        if (window.lockProjectUI) window.lockProjectUI();
                        if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t("Uploading image...") : "Uploading image...", 0, 'white', 'ic-save-toast');
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const res = await fetch('/infinite-canvas-api/upload', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ image_b64: event.target.result })
                                });
                                const data = await res.json();
                                if (window.ic_handle_payload) window.ic_handle_payload(data);
                            } catch (err) {
                                console.error("Upload failed:", err);
                            } finally {
                                if (window.unlockProjectUI) window.unlockProjectUI();
                                if (typeof icHideToast === 'function') icHideToast('ic-save-toast');
                            }
                        };
                        reader.readAsDataURL(blob);
                        return; // Done
                    }
                }
                window.ic_alert(typeof t === 'function' ? t('No image found in clipboard.') : 'No image found in clipboard.');
            } catch (err) {
                console.error("Paste failed:", err);
                window.ic_alert(typeof t === 'function' ? t('Failed to read clipboard. Please ensure you have granted clipboard permissions.') : 'Failed to read clipboard. Please ensure you have granted clipboard permissions.');
            }
        };
        
        const brushSizeSlider = document.getElementById('ic_float_brush_size');
        const brushSizeVal = document.getElementById('ic_float_brush_size_val');
        if (brushSizeSlider && brushSizeVal) {
            window.ic_brush_size = parseInt(brushSizeSlider.value, 10);
            brushSizeSlider.addEventListener('input', (e) => {
                brushSizeVal.innerText = e.target.value;
                window.ic_brush_size = parseInt(e.target.value, 10);
            });
        }

        const autoCropBtn = document.getElementById('ic_float_autocrop');
        const cropPopup = document.getElementById('ic_crop_popup');
        if (autoCropBtn && cropPopup) {
            autoCropBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (cropPopup.style.opacity === '0') {
                    cropPopup.style.opacity = '1';
                    cropPopup.style.pointerEvents = 'auto';
                    cropPopup.style.transform = 'translateX(-50%) translateY(0) scale(1)';
                    const btnRect = autoCropBtn.getBoundingClientRect();
                    const containerRect = document.getElementById('ic-container').getBoundingClientRect();
                    const offsetLeft = (btnRect.left + btnRect.width / 2) - containerRect.left;
                    cropPopup.style.left = offsetLeft + 'px';
                } else {
                    cropPopup.style.opacity = '0';
                    cropPopup.style.pointerEvents = 'none';
                    cropPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                }
            });
            document.addEventListener('click', (e) => {
                if (!autoCropBtn.contains(e.target) && !cropPopup.contains(e.target)) {
                    cropPopup.style.opacity = '0';
                    cropPopup.style.pointerEvents = 'none';
                    cropPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                }
            });

            document.getElementById('ic_crop_black')?.addEventListener('click', () => {
                cropPopup.style.opacity = '0';
                cropPopup.style.pointerEvents = 'none';
                window.ic_autoCrop('black');
            });
            document.getElementById('ic_crop_white')?.addEventListener('click', () => {
                cropPopup.style.opacity = '0';
                cropPopup.style.pointerEvents = 'none';
                window.ic_autoCrop('white');
            });
        }

        const floatResBtn = document.getElementById('ic_float_res_btn');
        const resPopup = document.getElementById('ic_res_popup');
        if (floatResBtn && resPopup) {
            floatResBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (resPopup.style.opacity === '0') {
                    resPopup.style.opacity = '1';
                    resPopup.style.pointerEvents = 'auto';
                    resPopup.style.transform = 'translateX(-50%) translateY(0) scale(1)';
                    const btnRect = floatResBtn.getBoundingClientRect();
                    const containerRect = document.getElementById('ic-container').getBoundingClientRect();
                    const offsetLeft = (btnRect.left + btnRect.width / 2) - containerRect.left;
                    resPopup.style.left = offsetLeft + 'px';
                } else {
                    resPopup.style.opacity = '0';
                    resPopup.style.pointerEvents = 'none';
                    resPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                }
            });
            document.addEventListener('click', (e) => {
                if (!floatResBtn.contains(e.target) && !resPopup.contains(e.target)) {
                    resPopup.style.opacity = '0';
                    resPopup.style.pointerEvents = 'none';
                    resPopup.style.transform = 'translateX(-50%) translateY(10px) scale(0.95)';
                }
            });
        }
    }, 1000);

    window.ic_autoCrop = function(mode) {
        if (!window.ic_tiles || Object.keys(window.ic_tiles).length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const TILE_SIZE = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const tileDataList = [];
        for (const key in window.ic_tiles) {
            const tileImg = window.ic_tiles[key];
            if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
                ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
                ctx.drawImage(tileImg, 0, 0);
                const imgData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
                const [tx, ty] = key.split(',').map(Number);
                
                let localMinX = TILE_SIZE, localMinY = TILE_SIZE, localMaxX = -1, localMaxY = -1;
                for (let y = 0; y < TILE_SIZE; y++) {
                    for (let x = 0; x < TILE_SIZE; x++) {
                        const i = (y * TILE_SIZE + x) * 4;
                        if (imgData[i+3] > 0) {
                            const r = imgData[i], g = imgData[i+1], b = imgData[i+2];
                            let isTarget = false;
                            if (mode === 'black') isTarget = (r <= 5 && g <= 5 && b <= 5);
                            if (mode === 'white') isTarget = (r >= 250 && g >= 250 && b >= 250);
                            
                            if (!isTarget) {
                                if (x < localMinX) localMinX = x;
                                if (x > localMaxX) localMaxX = x;
                                if (y < localMinY) localMinY = y;
                                if (y > localMaxY) localMaxY = y;
                            }
                        }
                    }
                }
                
                if (localMaxX >= 0) {
                    const globalX1 = tx * TILE_SIZE + localMinX;
                    const globalY1 = ty * TILE_SIZE + localMinY;
                    const globalX2 = tx * TILE_SIZE + localMaxX;
                    const globalY2 = ty * TILE_SIZE + localMaxY;
                    if (globalX1 < minX) minX = globalX1;
                    if (globalY1 < minY) minY = globalY1;
                    if (globalX2 > maxX) maxX = globalX2;
                    if (globalY2 > maxY) maxY = globalY2;
                }
                tileDataList.push({ key, tx, ty, img: tileImg });
            }
        }
        
        if (minX > maxX) return; // Empty or fully target color
        
        let changedTiles = 0;
        for (const t of tileDataList) {
            const tileGlobalX1 = t.tx * TILE_SIZE;
            const tileGlobalY1 = t.ty * TILE_SIZE;
            const tileGlobalX2 = tileGlobalX1 + TILE_SIZE - 1;
            const tileGlobalY2 = tileGlobalY1 + TILE_SIZE - 1;
            
            if (tileGlobalX2 < minX || tileGlobalX1 > maxX || tileGlobalY2 < minY || tileGlobalY1 > maxY) {
                delete window.ic_tiles[t.key];
                changedTiles++;
            } else {
                const needsCropLeft = tileGlobalX1 < minX;
                const needsCropRight = tileGlobalX2 > maxX;
                const needsCropTop = tileGlobalY1 < minY;
                const needsCropBottom = tileGlobalY2 > maxY;
                
                if (needsCropLeft || needsCropRight || needsCropTop || needsCropBottom) {
                    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
                    ctx.drawImage(t.img, 0, 0);
                    
                    if (needsCropTop) ctx.clearRect(0, 0, TILE_SIZE, minY - tileGlobalY1);
                    if (needsCropBottom) ctx.clearRect(0, maxY - tileGlobalY1 + 1, TILE_SIZE, tileGlobalY2 - maxY);
                    if (needsCropLeft) ctx.clearRect(0, 0, minX - tileGlobalX1, TILE_SIZE);
                    if (needsCropRight) ctx.clearRect(maxX - tileGlobalX1 + 1, 0, tileGlobalX2 - maxX, TILE_SIZE);
                    
                    const newImg = new Image();
                    newImg.src = canvas.toDataURL('image/png');
                    window.ic_tiles[t.key] = newImg;
                    changedTiles++;
                }
            }
        }
        
        if (changedTiles > 0) {
            if (typeof window.ic_saveState === 'function') window.ic_saveState();
            if (typeof window.ic_draw === 'function') window.ic_draw();
        }
    };

    window.ic_stitchTilesToBlob = function(callback) {
        if (!window.ic_tiles || Object.keys(window.ic_tiles).length === 0) {
            callback(null);
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const TILE_SIZE = 1024;
        
        const validTiles = [];
        
        for (const key in window.ic_tiles) {
            const tileImg = window.ic_tiles[key];
            if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
                const [tx, ty] = key.split(',').map(Number);
                validTiles.push({tx, ty, tileImg});
                minX = Math.min(minX, tx * TILE_SIZE);
                minY = Math.min(minY, ty * TILE_SIZE);
                maxX = Math.max(maxX, tx * TILE_SIZE + tileImg.naturalWidth);
                maxY = Math.max(maxY, ty * TILE_SIZE + tileImg.naturalHeight);
            }
        }
        if (minX === Infinity) {
            callback(null);
            return;
        }
        const offscreen = document.createElement('canvas');
        offscreen.width = maxX - minX;
        offscreen.height = maxY - minY;
        const octx = offscreen.getContext('2d');
        for (const item of validTiles) {
            octx.drawImage(item.tileImg, item.tx * TILE_SIZE - minX, item.ty * TILE_SIZE - minY);
        }
        offscreen.toBlob((blob) => {
            callback(blob);
        }, 'image/png');
    };

    const ctx = canvas.getContext('2d');
    
    // Initial size
    

    
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
    
    window.ic_tiles = {};
    
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

    window.ic_action_toggle_fullscreen = function() {
        const container = document.getElementById('ic-container');
        if (!container) return;
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    };

    window.ic_action_open_standalone = function() {
        const url = new URL(window.location.href);
        url.searchParams.set('ic-standalone', '1');
        window.open(url.toString(), '_blank');
    };

    // Apply standalone mode if requested in URL
    if (window.location.search.includes('ic-standalone=1')) {
        const applyStandalone = () => {
            const container = document.getElementById('ic-container');
            if (container) {
                // Move out of Gradio's tab system to ensure it's not hidden by display:none
                if (container.parentElement !== document.body) {
                    document.body.appendChild(container);
                }
                container.style.position = 'fixed';
                container.style.top = '0';
                container.style.left = '0';
                container.style.width = '100vw';
                container.style.height = '100vh';
                container.style.zIndex = '999999';
                container.style.margin = '0';
                container.style.padding = '0';
                container.style.borderRadius = '0';
                container.style.border = 'none';
                container.style.backgroundColor = 'var(--body-background-fill, #1e1e1e)';
                document.body.style.overflow = 'hidden';
            } else {
                setTimeout(applyStandalone, 50);
            }
        };
        applyStandalone();
    }
