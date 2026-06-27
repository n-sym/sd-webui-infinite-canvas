    window.ic_trigger_generate = async function() {
        calculateTargetRectFromMask();
        let maskBase64 = "";
        if (targetRect.w > 0 && targetRect.h > 0) {
            const maskC = document.createElement('canvas');
            maskC.width = targetRect.w;
            maskC.height = targetRect.h;
            const mctx = maskC.getContext('2d');
            mctx.imageSmoothingEnabled = false;
            mctx.fillStyle = 'black';
            mctx.fillRect(0, 0, maskC.width, maskC.height);

            const scaleX = maskDataCanvas.width / sourceRect.w;
            const scaleY = maskDataCanvas.height / sourceRect.h;

            const srcX = (targetRect.x - sourceRect.x) * scaleX;
            const srcY = (targetRect.y - sourceRect.y) * scaleY;
            const srcW = targetRect.w * scaleX;
            const srcH = targetRect.h * scaleY;

            mctx.drawImage(
                maskDataCanvas,
                srcX, srcY, srcW, srcH,
                0, 0, targetRect.w, targetRect.h
            );
            maskBase64 = maskC.toDataURL('image/png');
        }

        // All tunable params (parse_input's prompt/steps/cfg/... + every
        // plugin's params) are rendered as .ic-node-param inputs by
        // 07_workflow.js and scraped here into step_params. The backend's
        // ParseInputStep resolves step_params['parse_input'] onto ctx.
        const stepParams = {};
        document.querySelectorAll('.ic-node-param').forEach(input => {
            const nodeId = input.getAttribute('data-node-id');
            const paramName = input.getAttribute('data-param-name');
            if (!nodeId || !paramName) return;

            let val;
            if (input.type === 'checkbox') {
                val = input.checked;
            } else if (input.type === 'range' || input.type === 'number') {
                val = parseFloat(input.value);
            } else {
                val = input.value;
            }

            if (!stepParams[nodeId]) stepParams[nodeId] = {};
            stepParams[nodeId][paramName] = val;
        });

        const payload = {
            target_rect: targetRect,
            source_rect: sourceRect,
            mask_base64: maskBase64,
            step_params: stepParams
        };

        window.ic_current_task_id = "task(" + Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7) + ")";

        const reqData = {
            id_task: window.ic_current_task_id,
            payload_json: JSON.stringify(payload)
        };

        const genBtn = document.getElementById('ic-sidebar-generate-btn');
        const intBtn = document.getElementById('ic-sidebar-interrupt-btn');
        if (genBtn) genBtn.style.display = 'none';
        if (intBtn) intBtn.style.display = 'block';

        try {
            const res = await fetch('/infinite-canvas-api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqData)
            });
            const data = await res.json();
            
            const toast = document.getElementById('ic-progress-toast');
            if (toast && !window.exist_pending_generation) toast.style.display = 'none';
            
            if (data.status === 'error') {
                console.error("[Infinite Canvas] Generate error:", data.error);
                window.ic_alert("Error: " + data.error);
                return;
            }
            
            if (data.type === "generation_done" && data.tiles) {
                // Mock behavior for handling returned payload as original frontend did
                // Since the UI used Gradio's internal state mechanism, we must call the global payload handler.
                if (window.ic_handle_payload) {
                    window.ic_handle_payload(data);
                }
            } else if (data.type === "payload" && data.content) {
                if (window.ic_handle_payload) {
                    window.ic_handle_payload(JSON.parse(data.content));
                }
            } else {
                if (window.ic_handle_payload) {
                    window.ic_handle_payload(data);
                }
            }
        } catch (e) {
            console.error("[Infinite Canvas] Generate failed:", e);
            const toast = document.getElementById('ic-progress-toast');
            if (toast) toast.style.display = 'none';
            window.ic_alert("Failed to generate: " + e.message);
        } finally {
            // Generate/Interrupt are mutually exclusive. The generation has
            // returned, but it may have PAUSED on a dynamic_dialog (prompt
            // review / firstpass review) and still be alive server-side — in
            // that case keep Interrupt available so the user can abort the
            // suspended session, and DON'T clear the task id / re-enable
            // Generate (otherwise a second Generate could fire concurrently).
            if (window.exist_pending_generation) {
                if (genBtn) genBtn.style.display = 'none';
                if (intBtn) intBtn.style.display = 'block';
                // Leave ic_current_task_id set so the sidebar Generate guard
                // (line ~155 in 09_ui.js) blocks re-entry while paused.
            } else {
                window.ic_current_task_id = null;
                if (genBtn) genBtn.style.display = 'block';
                if (intBtn) intBtn.style.display = 'none';
            }
            // If the request resolved (apply/discard/done/error) before the
            // server's next inactive progress frame arrived, make sure the
            // progress and cancel toasts don't strand open.
            if (typeof icHideToast === 'function') {
                icHideToast('ic-progress-toast');
                icHideToast('ic-cancel-toast');
            }
            if (!window.exist_pending_generation) {
                window.icCancelling = false;
            }
        }
    };
    
    // Project Management Modal Logic
    const projectsBtn = document.getElementById('ic_float_projects');
    const projectsModal = document.getElementById('ic-projects-modal');
    const projectsList = document.getElementById('ic-projects-list');
    
    if (projectsBtn && projectsModal) {
        projectsBtn.addEventListener('click', async () => {
            projectsModal.style.display = 'flex';
            
            if (projectsBtn.animate) {
                const btnRect = projectsBtn.getBoundingClientRect();
                const panel = projectsModal.querySelector('.fluent-panel');
                
                projectsModal.animate([
                    { opacity: 0 },
                    { opacity: 1 }
                ], { duration: 250, easing: 'ease' });
                
                const panelRect = panel.getBoundingClientRect();
                const translateX = btnRect.left + btnRect.width/2 - (panelRect.left + panelRect.width/2);
                const translateY = btnRect.top + btnRect.height/2 - (panelRect.top + panelRect.height/2);
                const insetX = Math.max(0, (panelRect.width - btnRect.width) / 2);
                const insetY = Math.max(0, (panelRect.height - btnRect.height) / 2);
                
                panel.animate([
                    { transform: `translate(${translateX}px, ${translateY}px)`, clipPath: `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round 50px)` },
                    { transform: 'translate(0, 0)', clipPath: 'inset(0px 0px 0px 0px round 24px)' }
                ], { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
                
                panel.animate([
                    { opacity: 0 },
                    { opacity: 1 }
                ], { duration: 35, easing: 'linear' });
            }
            
            projectsList.innerHTML = `<div style="padding: 30px 20px; text-align: center; color: #888; font-size: 14px;">${typeof t === 'function' ? t('Loading projects...') : 'Loading projects...'}</div>`;
            try {
                const res = await fetch('/infinite-canvas-api/projects/list');
                const projects = await res.json();
                
                projectsList.innerHTML = '';
                if (projects.length === 0) {
                    projectsList.innerHTML = `<div style="padding: 30px 20px; text-align: center; color: color-mix(in srgb, var(--body-text-color, #fff) 60%, transparent); font-size: 14px;">${typeof t === 'function' ? t('No projects found.') : 'No projects found.'}</div>`;
                    return;
                }
                
                projects.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'fluent-card';
                    item.style.padding = '14px 16px';
                    item.style.marginBottom = '10px';
                    item.style.borderRadius = '12px';
                    item.style.display = 'flex';
                    item.style.alignItems = 'center';
                    item.style.background = 'color-mix(in srgb, var(--body-background-fill, #1e1e1e) 97%, var(--body-text-color, #fff))';
                    item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                    item.style.transition = 'background 0.2s';
                    item.style.cursor = 'pointer';
                    item.style.userSelect = 'none';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.style.color = 'var(--body-text-color, #fff)';
                    nameSpan.style.fontSize = '14px';
                    nameSpan.style.fontWeight = '700';
                    nameSpan.innerText = p.name;
                    
                    item.addEventListener('click', async () => {
                        if (window.ic_is_loading_or_saving) return;
                        window.lockProjectUI();
                        
                        if (window.ic_set_project_name) window.ic_set_project_name(p.name);
                        
                        if (window.closeProjectsModalWithAnimation) window.closeProjectsModalWithAnimation();
                        else projectsModal.style.display = 'none';
                        
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
                                } catch (e) {
                                    console.error("Load project error", e);
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
                        } catch (e) {
                            console.error("Check autosave error", e);
                            if (window.unlockProjectUI) window.unlockProjectUI();
                        }
                    });
                    
                    item.appendChild(nameSpan);
                    projectsList.appendChild(item);
                });
            } catch (e) {
                console.error("Error fetching projects", e);
                projectsList.innerHTML = `<div style="padding: 30px 20px; text-align: center; color: red; font-size: 14px;">Error loading projects.</div>`;
            }
        });
    }
    
    const setupRecoverBtn = (btnId, doRecover) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                const recoverModal = document.getElementById('ic-recover-modal');
                if (recoverModal) recoverModal.style.display = 'none';
                
                if (window._ic_recover_callback) {
                    window._ic_recover_callback(doRecover);
                    window._ic_recover_callback = null;
                }
            });
        }
    };
    
    setupRecoverBtn('ic-recover-btn-yes', true);
    setupRecoverBtn('ic-recover-btn-no', false);
    
    window.ic_is_loading_or_saving = false;
    window.lockProjectUI = function() {
        window.ic_is_loading_or_saving = true;
        const btn = document.getElementById('ic_float_projects');
        if (btn) btn.classList.add('disabled-state');
    };
    window.unlockProjectUI = function() {
        window.ic_is_loading_or_saving = false;
        const btn = document.getElementById('ic_float_projects');
        if (btn) btn.classList.remove('disabled-state');
    };
    

    window.ic_trigger_save_project = async function() {
        if (window.ic_is_loading_or_saving) return;
        window.lockProjectUI();

        const targetName = window.ic_get_project_name ? window.ic_get_project_name() : 'project';

        const payload = {
            viewport: {
                scale: scale,
                offsetX: offsetX,
                offsetY: offsetY,
                sourceRect: sourceRect,
                targetRect: targetRect
            },
            mask: maskDataCanvas.toDataURL('image/png')
        };

        try {
            const res = await fetch('/infinite-canvas-api/projects/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_name: targetName,
                    payload_json: JSON.stringify(payload)
                })
            });
            const data = await res.json();
            const listContainer = document.getElementById('ic-menu-projects-list');
            if (listContainer) listContainer.removeAttribute('data-loaded');
            if (window.ic_handle_payload) window.ic_handle_payload(data);
        } catch (e) {
            console.error("Save project error", e);
            if (typeof icHideToast === 'function') icHideToast('ic-save-toast');
        } finally {
            if (window.unlockProjectUI) window.unlockProjectUI();
        }
    };

    const saveProjectBtn = document.getElementById('ic-projects-save-btn');
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', async () => {
            await window.ic_trigger_save_project();
            if (window.closeProjectsModalWithAnimation) window.closeProjectsModalWithAnimation();
            else {
                const pm = document.getElementById('ic-projects-modal');
                if (pm) pm.style.display = 'none';
            }
        });
    }
    
    const importBtn = document.getElementById('ic-projects-import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (window.ic_is_loading_or_saving) return;
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.infcanvas,.png';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            
            fileInput.addEventListener('change', async (e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                const file = e.target.files[0];
                
                window.lockProjectUI();
                if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t("Importing project...") : "Importing project...", 0, 'white', 'ic-save-toast');
                
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64data = event.target.result;
                    try {
                        const res = await fetch('/infinite-canvas-api/projects/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                project_b64: base64data,
                                filename: file.name
                            })
                        });
                        const data = await res.json();
                        if (window.ic_handle_payload) window.ic_handle_payload(data);
                    } catch (err) {
                        console.error("Import failed:", err);
                    } finally {
                        if (window.unlockProjectUI) window.unlockProjectUI();
                        document.body.removeChild(fileInput);
                    }
                };
                reader.readAsDataURL(file);
            });
            
            fileInput.click();
            if (window.closeProjectsModalWithAnimation) window.closeProjectsModalWithAnimation();
            else projectsModal.style.display = 'none';
        });
    }
    
    const autosaveBtn = document.getElementById('ic_float_autosave');
    if (autosaveBtn) {
        autosaveBtn.addEventListener('click', () => {
            if (window.ic_action_toggle_autosave) window.ic_action_toggle_autosave();
        });
    }
    



    
    const guideBtn = document.getElementById('ic_guide_btn');
    if (guideBtn) {
        guideBtn.addEventListener('click', () => {
            const modal = document.getElementById('ic-guide-modal');
            if (modal) modal.style.display = 'flex';
        });
    }

    const downloadBtn = document.getElementById('ic_download_btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (window.ic_tiles && Object.keys(window.ic_tiles).length > 0) {
                window.ic_stitchTilesToBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'infinite_canvas_' + new Date().toISOString().replace(/:/g, '-') + '.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }
                });
            }
        });
    }

    window.icStartAutosavePoller = function() {
        // Disabled background poller to prevent repeated autosave dialogs
    };
    
    // Setup WebSocket for backend-to-frontend pushes.
    // Replaces: the old autosave MutationObserver poll, the 500ms progress
    // poll (now driven by server-pushed frames), and the front-end-only save
    // toast. Server pushes a heartbeat every ~25s so the socket stays alive
    // through proxies; a liveness watchdog falls back to polling if it stops.
    function setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/infinite-canvas-api/ws`;
        let ws = new WebSocket(wsUrl);
        window.icWS = ws;

        // Liveness watchdog: we expect a heartbeat (or any frame) at least every
        // ~35s. If we go stale, mark the WS dead so 08_progress.js resumes its
        // polling fallback, and force a reconnect.
        const HEARTBEAT_TIMEOUT_MS = 35000;
        if (window.icHeartbeatWatchdog) clearInterval(window.icHeartbeatWatchdog);
        window.icWSLastFrameTs = Date.now();
        window.icWSAlive = false; // not alive until first frame confirms round-trip
        window.icHeartbeatWatchdog = setInterval(() => {
            if (Date.now() - window.icWSLastFrameTs > HEARTBEAT_TIMEOUT_MS) {
                if (window.icWSAlive) {
                    console.warn("[IC] WS heartbeat stale — falling back to polling and forcing reconnect.");
                    window.icWSAlive = false;
                    try { ws.close(); } catch (e) {}
                }
            }
        }, 5000);

        ws.onopen = () => {
            // We don't declare alive until the first frame arrives — open alone
            // doesn't prove the pushers are running on the server side.
        };

        ws.onmessage = (event) => {
            window.icWSLastFrameTs = Date.now();
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                console.error("[IC] WS message parse error", e);
                return;
            }

            // ---- DEBUG: one-shot verbose log per distinct message kind ----
            // High-frequency frames (heartbeat, progress) log only the FIRST
            // occurrence so the console doesn't flood. Event frames (autosave,
            // save, toast, or anything unknown) log EVERY time, since those are
            // rare and exactly what you want to see arrive. Keyed by type +
            // status so e.g. autosave:saving and autosave:done both show up.
            try {
                if (!window.__icWSLogged) window.__icWSLogged = new Set();
                const key = data.type + (data.status !== undefined ? ':' + data.status : '');
                const isHighFreq = (data.type === 'heartbeat' || data.type === 'progress');
                if (isHighFreq) {
                    if (!window.__icWSLogged.has(key)) {
                        window.__icWSLogged.add(key);
                        console.log(`%c[IC WS] first ${data.type} frame arrived%o`, 'color:#4CAF50', data);
                    }
                } else {
                    // Always log event frames (dedupe identical repeats within 2s only,
                    // so a stuck sender still shows but doesn't spam).
                    const now = Date.now();
                    const lastKey = '__last_' + key;
                    if (!window[lastKey] || now - window[lastKey] > 2000) {
                        window[lastKey] = now;
                        console.log(`%c[IC WS] ${key}%o`, 'color:#2196F3', data);
                    }
                }
            } catch (e) {}

            switch (data.type) {
                case 'heartbeat':
                    // Server is keeping the socket warm. Mark alive so the polling
                    // fallback in 08_progress.js can go dormant.
                    window.icWSAlive = true;
                    break;

                case 'progress':
                    // Server-pushed progress frame (replaces the 500ms poll).
                    window.icWSAlive = true;
                    if (window.icRenderProgressFrame) window.icRenderProgressFrame(data);
                    break;

                case 'autosave':
                    // {status: 'saving' | 'done'}
                    window.icWSAlive = true;
                    if (data.status === 'saving') {
                        const toast = icGetOrCreateToast('ic-autosave-toast');
                        toast.querySelector('.ic-toast-text').innerText = t("Autosaving...");
                        toast.querySelector('.ic-toast-pct').innerText = '';
                        const barWrap = toast.querySelector('.ic-toast-bar').parentNode;
                        barWrap.style.display = 'block';
                        toast.children[0].style.marginBottom = '10px';
                        toast.querySelector('.ic-toast-bar').classList.add('ic-toast-bar-indeterminate');
                        icUpdateToastThemeForElement(toast, 'white');
                        icShowToast('ic-autosave-toast');
                    } else { // 'done'
                        const toast = document.getElementById('ic-autosave-toast');
                        if (toast) {
                            toast.querySelector('.ic-toast-text').innerText = t("Autosaved");
                            toast.querySelector('.ic-toast-pct').innerText = '';
                            const barWrap = toast.querySelector('.ic-toast-bar').parentNode;
                            barWrap.style.display = 'none';
                            toast.children[0].style.marginBottom = '0px';
                            icUpdateToastThemeForElement(toast, 'white');
                            icShowToast('ic-autosave-toast');
                            if (window.icAutosaveToastTimeout) clearTimeout(window.icAutosaveToastTimeout);
                            window.icAutosaveToastTimeout = setTimeout(() => icHideToast('ic-autosave-toast'), 1800);
                        }
                    }
                    break;

                case 'save':
                    // {status: 'saving' | 'done', name: ...}
                    window.icWSAlive = true;
                    if (data.status === 'saving') {
                        if (window.icShowCustomToast) {
                            window.icShowCustomToast(t("Saving project..."), 0, 'white', 'ic-save-toast');
                        }
                    } else { // 'done'
                        if (typeof icHideToast === 'function') icHideToast('ic-save-toast');
                        if (window.icShowCustomToast) {
                            window.icShowCustomToast(t("Project saved!"), 2500, 'white', 'ic-save-success-toast');
                        }
                    }
                    break;

                case 'toast':
                    // Legacy / generic toast (kept for any other backend pushes).
                    window.icWSAlive = true;
                    if (window.icShowCustomToast) {
                        window.icShowCustomToast(
                            typeof t === 'function' ? t(data.message) : data.message,
                            data.duration || 2000,
                            'white',
                            'ic-autosave-ws-toast'
                        );
                    }
                    break;
            }
        };

        ws.onerror = () => {
            // onclose will fire next; we reconnect there.
        };

        ws.onclose = () => {
            window.icWSAlive = false;
            setTimeout(setupWebSocket, 3000); // Reconnect after 3 seconds
        };
    }

    setupWebSocket();
    
    // Start it automatically on load if enabled (defaults to true)
    setTimeout(() => {
        window.ic_autosave_enabled = true;
        if (window.ic_update_autosave_ui) window.ic_update_autosave_ui();
        window.icStartAutosavePoller();
    }, 2000);

    const overlayBtn = document.getElementById('ic_show_overlay_btn');
    if (overlayBtn) {
        overlayBtn.addEventListener('click', () => {
            window.ic_show_overlay_state = !window.ic_show_overlay_state;
            
            if (window.ic_show_overlay_state) {
                overlayBtn.classList.add('primary');
                overlayBtn.classList.remove('secondary');
            } else {
                overlayBtn.classList.add('secondary');
                overlayBtn.classList.remove('primary');
            }
            
            const floatOverlayBtn = document.getElementById('ic_float_overlay');
            if (floatOverlayBtn) {
                if (window.ic_show_overlay_state) floatOverlayBtn.classList.add('primary');
                else floatOverlayBtn.classList.remove('primary');
            }
            
            if (typeof draw === 'function') draw();
        });
    }

    const autoScaleBtn = document.getElementById('ic_auto_scale_btn');
    if (autoScaleBtn) {
        autoScaleBtn.addEventListener('click', () => {
            window.ic_auto_scale_state = !window.ic_auto_scale_state;
            
            const autoScaleCb = document.querySelector('input.ic-node-param[data-node-id="parse_input"][data-param-name="auto_scale"]');
            if(autoScaleCb && autoScaleCb.checked !== window.ic_auto_scale_state) autoScaleCb.click();
            
            if (window.ic_auto_scale_state) {
                autoScaleBtn.classList.add('primary');
                autoScaleBtn.classList.remove('secondary');
            } else {
                autoScaleBtn.classList.add('secondary');
                autoScaleBtn.classList.remove('primary');
            }
            
            const floatAutoScaleBtn = document.getElementById('ic_float_autoscale');
            if (floatAutoScaleBtn) {
                if (window.ic_auto_scale_state) floatAutoScaleBtn.classList.add('primary');
                else floatAutoScaleBtn.classList.remove('primary');
            }
        });
    }

    const copyBtn = document.getElementById('ic_copy_btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (window.ic_tiles && Object.keys(window.ic_tiles).length > 0) {
                window.ic_stitchTilesToBlob((blob) => {
                    if (blob) {
                        const item = new ClipboardItem({ 'image/png': blob });
                        navigator.clipboard.write([item]).then(() => {
                            const oldText = copyBtn.innerText;
                            copyBtn.innerText = typeof t === 'function' ? t('Copied!') : 'Copied!';
                            setTimeout(() => {
                                copyBtn.innerText = oldText;
                            }, 2000);
                        }).catch(e => {
                            console.error('Copy failed:', e);
                        });
                    }
                });
            }
        });
    }
