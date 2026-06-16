    
    // Initial load empty
        // --- MODAL LOGIC ---
        let modalVisible = false;
        let pendingUpdate = null;
        let pendingPatchImage = new Image();
        let pendingMaskImage = new Image();
        let pendingEdgeMaskImage = new Image();
        let imagesLoaded = 0;
        let imagesToLoad = 0;
        let showEdgeMask = false;
        let featherRadius = 0;
        
        let cachedPatchCanvas = null;
        let lastPatchSource = null;
        let lastMaskSource = null;
        let lastFeatherRadius = -1;
        
        let cachedHighlightCanvas = null;
        let lastEdgeMaskSource = null;
        

        
        // Setup Feather slider
        const featherSlider = document.getElementById('ic-modal-feather');
        const featherValDisplay = document.getElementById('ic-modal-feather-val');
        if (featherSlider) {
            featherSlider.addEventListener('input', (e) => {
                featherRadius = parseInt(e.target.value);
                featherValDisplay.innerText = featherRadius;
                
                // No hidden gradio input to update anymore
            });
        }
        window.ic_continue_generation = async function(session_id, result_data) {
            console.log("[Infinite Canvas] ic_continue_generation called with session_id:", session_id, "result_data:", result_data);
            const dynamicModal = document.getElementById('ic_dynamic_modal');
            if (dynamicModal) dynamicModal.style.display = 'none';
            window.exist_pending_generation = false;

            const resumePayload = Object.assign({ session_id: session_id }, result_data);

            // Generate/Interrupt mutual exclusion across the /cont resume.
            // If continuing (not cancelling), the pipeline is running again →
            // show Interrupt, hide Generate, set a task id to block re-entry.
            // If cancelling, just restore the Generate button.
            const isCancel = !!(result_data && result_data.action === 'cancel');
            const genBtn = document.getElementById('ic-sidebar-generate-btn');
            const intBtn = document.getElementById('ic-sidebar-interrupt-btn');
            if (!isCancel) {
                window.ic_current_task_id = "task(" + Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7) + ")";
                if (genBtn) genBtn.style.display = 'none';
                if (intBtn) intBtn.style.display = 'block';
            } else {
                window.ic_current_task_id = null;
                if (genBtn) genBtn.style.display = 'block';
                if (intBtn) intBtn.style.display = 'none';
            }

            try {
                const res = await fetch('/infinite-canvas-api/cont', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payload_json: JSON.stringify(resumePayload) })
                });
                const data = await res.json();
                if (window.ic_handle_payload) window.ic_handle_payload(data);
            } catch (e) {
                console.error("Failed to resume:", e);
            } finally {
                // Mirror the generate() finally: if the resume paused again on
                // another dynamic_dialog, keep Interrupt; otherwise restore Generate.
                if (window.exist_pending_generation) {
                    if (genBtn) genBtn.style.display = 'none';
                    if (intBtn) intBtn.style.display = 'block';
                } else {
                    window.ic_current_task_id = null;
                    if (genBtn) genBtn.style.display = 'block';
                    if (intBtn) intBtn.style.display = 'none';
                }
                if (typeof icHideToast === 'function') {
                    icHideToast('ic-progress-toast');
                    icHideToast('ic-cancel-toast');
                }
                if (!window.exist_pending_generation) {
                    window.icCancelling = false;
                }
            }
        };

        
        function onModalImageLoad() {
            imagesLoaded++;
            if (imagesLoaded >= imagesToLoad) {
                drawModal();
            }
        }
        pendingPatchImage.onload = onModalImageLoad;
        pendingMaskImage.onload = onModalImageLoad;
        pendingEdgeMaskImage.onload = onModalImageLoad;
        
        const toggleEdgeBtn = document.getElementById('ic-modal-toggle-edge');
        if (toggleEdgeBtn) {
            toggleEdgeBtn.addEventListener('click', () => {
                showEdgeMask = !showEdgeMask;
                if (showEdgeMask) {
                    toggleEdgeBtn.style.background = '#2196F3'; // Blue when active
                } else {
                    toggleEdgeBtn.style.background = '#555'; // Grey when inactive
                }
                drawModal();
            });
        }
        
        let previewScale = 1;
        let previewCenterX = 0;
        let previewCenterY = 0;
        let modalDragging = false;
        let modalLastX, modalLastY;
        
        const modalOverlay = document.getElementById('ic-modal-overlay');
        const modalBtnDiscard = document.getElementById('ic-modal-discard');
        const modalBtnApply = document.getElementById('ic-modal-apply');
        
        function drawBlueBox(ctx, x, y, w, h, scale, angle=0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
            ctx.lineWidth = 2 / scale;
            const genSize = typeof getGenSize === 'function' ? getGenSize() : {w: 1024, h: 1024};
            if (Math.abs(w - genSize.w) < 1 && Math.abs(h - genSize.h) < 1 && Math.abs(angle) < 0.001) {
                ctx.setLineDash([]);
            } else {
                ctx.setLineDash([5 / scale, 5 / scale]);
            }
            if (angle) {
                ctx.translate(x + w/2, y + h/2);
                ctx.rotate(angle);
                ctx.strokeRect(-w/2, -h/2, w, h);
            } else {
                ctx.strokeRect(x, y, w, h);
            }
            ctx.restore();
        }
                function drawModal() {
            if (!modalVisible) return;
            
            ['old', 'new'].forEach(type => {
                const modalCanvas = document.getElementById(`ic-modal-canvas-${type}`);
                if(!modalCanvas) return;
                const mctx = modalCanvas.getContext('2d');
                
                const dpr = window.devicePixelRatio || 1;
                const rect = modalCanvas.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return; // Prevent collapse when tab is hidden
                
                const targetW = Math.round(rect.width * dpr);
                const targetH = Math.round(rect.height * dpr);
                if(modalCanvas.width !== targetW || modalCanvas.height !== targetH) {
                    modalCanvas.width = targetW;
                    modalCanvas.height = targetH;
                    modalCanvas.style.width = rect.width + 'px';
                    modalCanvas.style.height = rect.height + 'px';
                }
                
                mctx.imageSmoothingEnabled = true;
                mctx.imageSmoothingQuality = 'high';
                
                // Solid background without checkerboard
                mctx.fillStyle = '#222';
                mctx.fillRect(0,0,modalCanvas.width,modalCanvas.height);
                
                let currentScale = previewScale;
                let currentCenterX = previewCenterX;
                let currentCenterY = previewCenterY;
                
                if (pendingUpdate && pendingUpdate.transform) {
                    const t = pendingUpdate.transform;
                    currentScale = previewScale / t.scale;
                    currentCenterX = previewCenterX * t.scale + t.pad_left;
                    currentCenterY = previewCenterY * t.scale + t.pad_top;
                }
                
                if (type === 'old') {
                    if (window.ic_tiles) {
                        mctx.save();
                        mctx.scale(dpr, dpr);
                        mctx.translate(rect.width/2, rect.height/2);
                        mctx.scale(currentScale, currentScale);
                        mctx.translate(-currentCenterX, -currentCenterY);
                        
                        const TILE_SIZE = 1024;
                        for (const key in window.ic_tiles) {
                            const [tx, ty] = key.split(',').map(Number);
                            const tileImg = window.ic_tiles[key];
                            if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
                                mctx.drawImage(tileImg, tx * TILE_SIZE, ty * TILE_SIZE);
                            }
                        }
                        
                        let bx = sourceRect.x;
                        let by = sourceRect.y;
                        let bw = sourceRect.w;
                        let bh = sourceRect.h;
                        
                        if (pendingUpdate && pendingUpdate.transform) {
                            const t = pendingUpdate.transform;
                            bx = t.rect_x;
                            by = t.rect_y;
                            bw = pendingPatchImage.width;
                            bh = pendingPatchImage.height;
                        }
                        
                        drawBlueBox(mctx, bx, by, bw, bh, currentScale, sourceRect.angle || 0);
                        
                        mctx.restore();
                    }
                } else if (type === 'new') {
                    if (window.ic_tiles && pendingPatchImage.complete && pendingMaskImage.complete) {
                        mctx.save();
                        mctx.scale(dpr, dpr);
                        mctx.translate(rect.width/2, rect.height/2);
                        mctx.scale(currentScale, currentScale);
                        mctx.translate(-currentCenterX, -currentCenterY);
                        
                        const TILE_SIZE = 1024;
                        for (const key in window.ic_tiles) {
                            const [tx, ty] = key.split(',').map(Number);
                            const tileImg = window.ic_tiles[key];
                            if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
                                mctx.drawImage(tileImg, tx * TILE_SIZE, ty * TILE_SIZE);
                            }
                        }
                        
                        if (pendingUpdate && pendingUpdate.transform) {
                            const t = pendingUpdate.transform;
                            
                            if (!cachedPatchCanvas || lastPatchSource !== pendingPatchImage.src || lastMaskSource !== pendingMaskImage.src || lastFeatherRadius !== featherRadius) {
                                cachedPatchCanvas = document.createElement('canvas');
                                cachedPatchCanvas.width = pendingPatchImage.width;
                                cachedPatchCanvas.height = pendingPatchImage.height;
                                const pctx = cachedPatchCanvas.getContext('2d');
                                
                                pctx.drawImage(pendingPatchImage, 0, 0);
                                pctx.globalCompositeOperation = 'destination-in';
                                if (featherRadius > 0) {
                                    pctx.filter = `blur(${featherRadius}px)`;
                                }
                                pctx.drawImage(pendingMaskImage, 0, 0);
                                
                                lastPatchSource = pendingPatchImage.src;
                                lastMaskSource = pendingMaskImage.src;
                                lastFeatherRadius = featherRadius;
                            }
                            
                            const rx = t.rect_x;
                            const ry = t.rect_y;
                            
                            mctx.save();
                            const cx = rx + pendingPatchImage.width / 2;
                            const cy = ry + pendingPatchImage.height / 2;
                            mctx.translate(cx, cy);
                            mctx.rotate(sourceRect.angle || 0);
                            
                            mctx.drawImage(cachedPatchCanvas, -pendingPatchImage.width / 2, -pendingPatchImage.height / 2);
                            
                            if (showEdgeMask && pendingEdgeMaskImage.complete && pendingEdgeMaskImage.naturalWidth > 0) {
                                if (!cachedHighlightCanvas || lastEdgeMaskSource !== pendingEdgeMaskImage.src) {
                                    cachedHighlightCanvas = document.createElement('canvas');
                                    cachedHighlightCanvas.width = pendingEdgeMaskImage.width;
                                    cachedHighlightCanvas.height = pendingEdgeMaskImage.height;
                                    const hctx = cachedHighlightCanvas.getContext('2d');
                                    hctx.drawImage(pendingEdgeMaskImage, 0, 0);
                                    hctx.globalCompositeOperation = 'source-in';
                                    hctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                                    hctx.fillRect(0, 0, cachedHighlightCanvas.width, cachedHighlightCanvas.height);
                                    lastEdgeMaskSource = pendingEdgeMaskImage.src;
                                }
                                
                                mctx.save();
                                const ecx = rx + pendingEdgeMaskImage.width / 2;
                                const ecy = ry + pendingEdgeMaskImage.height / 2;
                                mctx.translate(ecx, ecy);
                                mctx.rotate(sourceRect.angle || 0);
                                mctx.drawImage(cachedHighlightCanvas, -pendingEdgeMaskImage.width / 2, -pendingEdgeMaskImage.height / 2);
                                mctx.restore();
                            }
                            
                            // Re-use drawBlueBox logic but adjusted for center coordinates
                            mctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
                            mctx.lineWidth = 2 / currentScale;
                            const genSize = typeof getGenSize === 'function' ? getGenSize() : {w: 1024, h: 1024};
                            const currentAngle = sourceRect.angle || 0;
                            if (Math.abs(pendingPatchImage.width - genSize.w) < 1 && Math.abs(pendingPatchImage.height - genSize.h) < 1 && Math.abs(currentAngle) < 0.001) {
                                mctx.setLineDash([]);
                            } else {
                                mctx.setLineDash([5 / currentScale, 5 / currentScale]);
                            }
                            mctx.strokeRect(-pendingPatchImage.width / 2, -pendingPatchImage.height / 2, pendingPatchImage.width, pendingPatchImage.height);
                            
                            mctx.restore();
                        }
                        
                        mctx.restore();
                    }
                }
            });
        }
        
        ['old', 'new'].forEach(type => {
            const mc = document.getElementById(`ic-modal-canvas-${type}`);
            if(!mc) return;
            mc.addEventListener('mousedown', (e) => {
                modalDragging = true;
                modalLastX = e.clientX;
                modalLastY = e.clientY;
            });
            mc.addEventListener('contextmenu', (e) => e.preventDefault());
            mc.addEventListener('wheel', (e) => {
                if(!modalVisible) return;
                e.preventDefault();
                const rect = mc.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                
                const worldMouseX = previewCenterX + (sx - mc.width/2) / previewScale;
                const worldMouseY = previewCenterY + (sy - mc.height/2) / previewScale;
                
                const zoomFactor = e.deltaY < 0 ? 1.1 : (1 / 1.1);
                previewScale *= zoomFactor;
                
                previewCenterX = worldMouseX - (sx - mc.width/2) / previewScale;
                previewCenterY = worldMouseY - (sy - mc.height/2) / previewScale;
                
                drawModal();
            });
        });
        
        window.addEventListener('mousemove', (e) => {
            if (modalDragging && modalVisible) {
                const dx = e.clientX - modalLastX;
                const dy = e.clientY - modalLastY;
                previewCenterX -= dx / previewScale;
                previewCenterY -= dy / previewScale;
                modalLastX = e.clientX;
                modalLastY = e.clientY;
                drawModal();
            }
        });
        
        window.addEventListener('mouseup', () => { modalDragging = false; });
        
        modalBtnDiscard.addEventListener('click', async () => {
            modalVisible = false;
            modalOverlay.style.display = 'none';
            pendingUpdate = null;
            pendingPatchImage.src = '';
            pendingMaskImage.src = '';
            pendingEdgeMaskImage.src = '';
            try {
                const res = await fetch('/infinite-canvas-api/discard', { method: 'POST' });
                const data = await res.json();
                if (window.ic_handle_payload) window.ic_handle_payload(data);
            } catch (e) {
                console.error("Discard error:", e);
            }
        });
        
        modalBtnApply.addEventListener('click', async () => {
            modalVisible = false;
            modalOverlay.style.display = 'none';
            
            // We must update the transform locally BEFORE clicking apply, because apply will just return the final image!
            if (pendingUpdate && pendingUpdate.transform) {
                const t = pendingUpdate.transform;
                sourceRect.x = t.rect_x;
                sourceRect.y = t.rect_y;
                sourceRect.w = pendingPatchImage.width;
                sourceRect.h = pendingPatchImage.height;
                
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const centerWorldX = (cx - offsetX) / scale;
                const centerWorldY = (cy - offsetY) / scale;
                const newCenterWorldX = centerWorldX * t.scale + t.pad_left;
                const newCenterWorldY = centerWorldY * t.scale + t.pad_top;
                scale = scale / t.scale;
                offsetX = cx - newCenterWorldX * scale;
                offsetY = cy - newCenterWorldY * scale;
                
                clearMask();
                // After apply with transform the canvas context has changed entirely;
                // old mask history references stale dimensions, so reset it
                resetMaskHistory();
            }
            pendingPatchImage.src = '';
            pendingMaskImage.src = '';
            pendingEdgeMaskImage.src = '';
            try {
                const res = await fetch('/infinite-canvas-api/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ feather_radius: featherRadius })
                });
                const data = await res.json();
                if (window.ic_handle_payload) window.ic_handle_payload(data);
            } catch (e) {
                console.error("Apply error:", e);
            }
        });
        
        // Modal render loop — only schedules frames while modal is visible
        const modalLoop = () => {
            if(modalVisible) {
                drawModal();
                requestAnimationFrame(modalLoop);
            }
        };

        window.ic_handle_payload = function(data) {
            try {
                if (window.ic_handle_workflow_output) window.ic_handle_workflow_output(data);
                if (window.icStartAutosavePoller) window.icStartAutosavePoller();
                    
                    const populateTiles = (tilesArray) => {
                        window.ic_tiles = {};
                        if (!tilesArray) return;
                        for (let i = 0; i < tilesArray.length; i++) {
                            let t = tilesArray[i];
                            let img = new Image();
                            img.onload = () => { if(typeof draw === 'function') draw(); };
                            img.src = t.data;
                            window.ic_tiles[`${t.tx},${t.ty}`] = img;
                        }
                        if (tilesArray.length === 0 && typeof draw === 'function') {
                            draw();
                        }
                    };

                    if (data.type === 'toggle' || data.type === 'upload' || data.type === 'discard' || data.type === 'apply' || data.type === 'project_load' || data.type === 'session_cleared' || data.type === 'session_clear') {
                        if (data.tiles) {
                            populateTiles(data.tiles);
                        }
                        
                        if (data.type === 'project_load') {
                            if (typeof icHideToast === 'function') {
                                icHideToast('ic-autosave-toast');
                                icHideToast('ic-save-toast');
                            }
                            if (window.icShowCustomToast) {
                                window.icShowCustomToast(typeof t === 'function' ? t("Project loaded successfully!") : "Project loaded successfully!", 3000, 'white', 'ic-load-toast');
                                let toast = document.getElementById('ic-load-toast');
                                if (toast) {
                                    toast.querySelector('.ic-toast-bar').parentNode.style.display = 'none';
                                    toast.children[0].style.marginBottom = '0';
                                }
                            }
                            
                            // 1. Restore viewport FIRST
                            if (data.viewport) {
                                if (data.viewport.scale !== undefined) scale = data.viewport.scale;
                                if (data.viewport.offsetX !== undefined) offsetX = data.viewport.offsetX;
                                if (data.viewport.offsetY !== undefined) offsetY = data.viewport.offsetY;
                                if (data.viewport.sourceRect) {
                                    sourceRect = data.viewport.sourceRect;
                                    if (data.viewport.targetRect) {
                                        targetRect = data.viewport.targetRect;
                                    } else {
                                        targetRect.x = sourceRect.x;
                                        targetRect.y = sourceRect.y;
                                        targetRect.w = sourceRect.w;
                                        targetRect.h = sourceRect.h;
                                    }
                                }
                            }

                            // 2. Fetch workflow, apply it, enforce aspect ratio, THEN load mask
                            fetch('/infinite-canvas-api/workflow')
                                .then(res => res.json())
                                .then(wdata => {
                                    if (window.ic_handle_workflow_output) window.ic_handle_workflow_output(wdata);
                                    if (typeof enforceSourceRatio === 'function') enforceSourceRatio();
                                    if (typeof draw === 'function') draw(); // Update blue box

                                    // Load mask LAST, stretching it to the finalized maskDataCanvas resolution
                                    if (data.mask && data.mask.trim().length > 0) {
                                        const img = new Image();
                                        img.onload = () => {
                                            const res = window.ic_getMaskResolution();
                                            maskDataCanvas.width = res.w;
                                            maskDataCanvas.height = res.h;
                                            maskDataCtx = maskDataCanvas.getContext('2d', {willReadFrequently: true});
                                            maskDataCtx.imageSmoothingEnabled = false;
                                            maskDataCtx.clearRect(0, 0, maskDataCanvas.width, maskDataCanvas.height);
                                            maskDataCtx.drawImage(img, 0, 0, maskDataCanvas.width, maskDataCanvas.height);
                                            if (typeof resetMaskHistory === 'function') resetMaskHistory();
                                            if (typeof draw === 'function') draw();
                                        };
                                        img.src = data.mask;
                                    } else {
                                        const res = window.ic_getMaskResolution();
                                        maskDataCanvas.width = res.w;
                                        maskDataCanvas.height = res.h;
                                        maskDataCtx = maskDataCanvas.getContext('2d', {willReadFrequently: true});
                                        maskDataCtx.imageSmoothingEnabled = false;
                                        maskDataCtx.clearRect(0, 0, maskDataCanvas.width, maskDataCanvas.height);
                                        if (typeof resetMaskHistory === 'function') resetMaskHistory();
                                        if (typeof draw === 'function') draw();
                                    }
                                })
                                .catch(e => console.error("Failed to fetch workflow after load", e));
                        }
                        if (data.type === 'session_clear' || data.type === 'session_cleared') {
                            scale = 1;
                            offsetX = 0;
                            offsetY = 0;
                            
                            sourceRect.x = 0;
                            sourceRect.y = 0;
                            sourceRect.w = 1024;
                            sourceRect.h = 1024;
                            sourceRect.angle = 0;
                            
                            maskDataCanvas.width = 1024;
                            maskDataCanvas.height = 1024;
                            maskDataCtx = maskDataCanvas.getContext('2d', {willReadFrequently: true});
                            maskDataCtx.clearRect(0, 0, maskDataCanvas.width, maskDataCanvas.height);
                            
                            if (typeof draw === 'function') draw();
                        }
                    } else if (data.type === 'preview') {
                        // Delay applying! Show Modal instead.
                        pendingUpdate = data;
                        previewScale = scale;
                        previewCenterX = (canvas.width / 2 - offsetX) / scale;
                        previewCenterY = (canvas.height / 2 - offsetY) / scale;

                        // Cache the seed Forge actually sampled so the seed
                        // row's "reuse" button can replay it. When the user
                        // sent seed=-1 this is the randomly-chosen value.
                        if (data.used_seed !== undefined && data.used_seed !== null) {
                            window.ic_last_used_seed = data.used_seed;
                        }
                        
                        imagesLoaded = 0;
                        imagesToLoad = 2;
                        pendingPatchImage.src = data.patch;
                        pendingMaskImage.src = data.mask;
                        
                        if (data.tiles) populateTiles(data.tiles);
                        
                        const toggleEdgeBtn = document.getElementById('ic-modal-toggle-edge');
                        showEdgeMask = false; // Reset to off by default
                        if (data.edge_mask) {
                            imagesToLoad = 3;
                            pendingEdgeMaskImage.src = data.edge_mask;
                            if (toggleEdgeBtn) {
                                toggleEdgeBtn.style.display = 'block';
                                toggleEdgeBtn.style.background = '#555';
                            }
                        } else {
                            if (toggleEdgeBtn) toggleEdgeBtn.style.display = 'none';
                        }
                        
                        modalVisible = true;
                        requestAnimationFrame(modalLoop);
                        modalOverlay.style.display = 'flex';
                    } else if (data.type === 'dynamic_dialog') {
                        console.log("[Infinite Canvas] Received dynamic_dialog payload:", data);
                        const dynamicModal = document.getElementById('ic_dynamic_modal');
                        const dynamicModalTitle = document.getElementById('ic_dynamic_modal_title');
                        const dynamicModalContent = document.getElementById('ic_dynamic_modal_content');

                        if (!dynamicModal || !dynamicModalTitle || !dynamicModalContent) {
                            console.error("[Infinite Canvas] Failed to find dynamic modal elements in DOM.");
                        } else {
                            console.log("[Infinite Canvas] Found dynamic modal elements, displaying dialog.");
                        }

                        window.exist_pending_generation = true;
                        
                        if (dynamicModalTitle) dynamicModalTitle.innerText = data.title || t("Dialog");
                        if (dynamicModalContent) dynamicModalContent.innerHTML = data.html || "";
                        if (dynamicModal) dynamicModal.style.display = 'flex';
                        
                        if (data.js) {
                            try {
                                console.log("[Infinite Canvas] Executing dynamic dialog JS snippet.");
                                const fn = new Function('session_id', 'modal', data.js);
                                fn(data.session_id, dynamicModal);
                            } catch(e) {
                                console.error("[Infinite Canvas] Error executing dynamic dialog JS:", e);
                            }
                        }

                        
                    } else if (data.type === 'error') {
                        if (window.unlockProjectUI) window.unlockProjectUI();
                        console.error("[Infinite Canvas]", data.message);
                        if (window.icShowCustomToast) window.icShowCustomToast(data.message, 3000, 'red', 'ic-error-toast');
                    } else if (data.type === 'sam_result') {
                        if (data.mask) {
                            const img = new Image();
                            img.onload = () => {
                                maskDataCtx.globalCompositeOperation = 'source-over';
                                maskDataCtx.imageSmoothingEnabled = false;
                                maskDataCtx.drawImage(img, 0, 0, maskDataCanvas.width, maskDataCanvas.height);
                                saveMaskState(); // Save after Magic Wand stroke for undo
                                draw();
                                document.body.style.cursor = 'default';
                                canvas.style.cursor = 'crosshair';
                            };
                            img.src = data.mask;
                        }
                    } else if (data.type === 'error') {
                        console.error("Backend Error:", data.message);
                        alert(t("Error: ") + data.message);
                        document.body.style.cursor = 'default';
                        canvas.style.cursor = 'crosshair';
                    }
            } catch (e) {
                console.error("Failed to parse result payload", e);
            }
        };
