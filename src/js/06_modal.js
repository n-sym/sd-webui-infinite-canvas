    
    const outArea = document.querySelector('#ic_output textarea');
    if (outArea) {
        let lastText = "";
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
        
        // Setup Session Modal
        const sessionModal = document.getElementById('ic-session-modal');
        const sessionPreview = document.getElementById('ic-session-preview');
        if (sessionModal) {
            document.getElementById('ic-session-yes').addEventListener('click', () => {
                sessionModal.style.display = 'none';
                document.getElementById('ic_restore_session_btn')?.click();
            });
            document.getElementById('ic-session-no').addEventListener('click', () => {
                sessionModal.style.display = 'none';
                document.getElementById('ic_clear_session_btn')?.click();
            });
        }
        
        // Setup Feather slider
        const featherSlider = document.getElementById('ic-modal-feather');
        const featherValDisplay = document.getElementById('ic-modal-feather-val');
        if (featherSlider) {
            featherSlider.addEventListener('input', (e) => {
                featherRadius = parseInt(e.target.value);
                featherValDisplay.innerText = featherRadius;
                
                // Update hidden gradio input
                const hiddenFeather = document.querySelector('#ic_apply_feather_input input');
                if (hiddenFeather) {
                    hiddenFeather.value = featherRadius;
                    hiddenFeather.dispatchEvent(new Event('input', {bubbles: true}));
                }
            });
        }
        
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
        
        function drawBlueBox(ctx, x, y, w, h, scale) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
            ctx.lineWidth = 2 / scale;
            ctx.setLineDash([5 / scale, 5 / scale]);
            ctx.strokeRect(x, y, w, h);
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
                    if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
                        mctx.save();
                        mctx.scale(dpr, dpr);
                        mctx.translate(rect.width/2, rect.height/2);
                        mctx.scale(currentScale, currentScale);
                        mctx.translate(-currentCenterX, -currentCenterY);
                        mctx.drawImage(bgImage, 0, 0);
                        
                        let bx = sourceRect.x;
                        let by = sourceRect.y;
                        let bw = sourceRect.w;
                        let bh = sourceRect.h;
                        
                        if (pendingUpdate && pendingUpdate.transform) {
                            const t = pendingUpdate.transform;
                            bx = bx * t.scale + t.pad_left;
                            by = by * t.scale + t.pad_top;
                            bw *= t.scale;
                            bh *= t.scale;
                        }
                        
                        drawBlueBox(mctx, bx, by, bw, bh, currentScale);
                        
                        mctx.restore();
                    }
                } else if (type === 'new') {
                    if (bgImage && pendingPatchImage.complete && pendingMaskImage.complete) {
                        mctx.save();
                        mctx.scale(dpr, dpr);
                        mctx.translate(rect.width/2, rect.height/2);
                        mctx.scale(currentScale, currentScale);
                        mctx.translate(-currentCenterX, -currentCenterY);
                        
                        mctx.drawImage(bgImage, 0, 0);
                        
                        if (pendingUpdate && pendingUpdate.transform) {
                            const t = pendingUpdate.transform;
                            
                            const patchCanvas = document.createElement('canvas');
                            patchCanvas.width = pendingPatchImage.width;
                            patchCanvas.height = pendingPatchImage.height;
                            const pctx = patchCanvas.getContext('2d');
                            
                            pctx.drawImage(pendingPatchImage, 0, 0);
                            pctx.globalCompositeOperation = 'destination-in';
                            if (featherRadius > 0) {
                                pctx.filter = `blur(${featherRadius}px)`;
                            }
                            pctx.drawImage(pendingMaskImage, 0, 0);
                            
                            const rx = t.rect_x;
                            const ry = t.rect_y;
                            
                            mctx.save();
                            const cx = rx + pendingPatchImage.width / 2;
                            const cy = ry + pendingPatchImage.height / 2;
                            mctx.translate(cx, cy);
                            mctx.rotate(sourceRect.angle || 0);
                            
                            mctx.drawImage(patchCanvas, -pendingPatchImage.width / 2, -pendingPatchImage.height / 2);
                            
                            if (showEdgeMask && pendingEdgeMaskImage.complete) {
                                mctx.save();
                                const highlightCanvas = document.createElement('canvas');
                                highlightCanvas.width = pendingEdgeMaskImage.width;
                                highlightCanvas.height = pendingEdgeMaskImage.height;
                                const hctx = highlightCanvas.getContext('2d');
                                hctx.fillStyle = 'rgba(255, 60, 60, 0.9)'; // brighter red highlight
                                hctx.fillRect(0, 0, highlightCanvas.width, highlightCanvas.height);
                                hctx.globalCompositeOperation = 'destination-in';
                                hctx.drawImage(pendingEdgeMaskImage, 0, 0);
                                
                                mctx.drawImage(highlightCanvas, -pendingPatchImage.width / 2, -pendingPatchImage.height / 2);
                                mctx.restore();
                            }
                            
                            // Re-use drawBlueBox logic but adjusted for center coordinates
                            mctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
                            mctx.lineWidth = 2 / currentScale;
                            mctx.setLineDash([5 / currentScale, 5 / currentScale]);
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
                
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
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
        
        modalBtnDiscard.addEventListener('click', () => {
            modalVisible = false;
            modalOverlay.style.display = 'none';
            pendingUpdate = null;
            pendingPatchImage.src = '';
            pendingMaskImage.src = '';
            pendingEdgeMaskImage.src = '';
            const discardBtn = document.getElementById('ic_discard_hidden');
            if (discardBtn) discardBtn.click();
        });
        
        modalBtnApply.addEventListener('click', () => {
            modalVisible = false;
            modalOverlay.style.display = 'none';
            
            // We must update the transform locally BEFORE clicking apply, because apply will just return the final image!
            if (pendingUpdate && pendingUpdate.transform) {
                const t = pendingUpdate.transform;
                sourceRect.x = sourceRect.x * t.scale + t.pad_left;
                sourceRect.y = sourceRect.y * t.scale + t.pad_top;
                sourceRect.w *= t.scale;
                sourceRect.h *= t.scale;
                
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
            const applyBtn = document.getElementById('ic_apply_hidden');
            if (applyBtn) applyBtn.click();
        });
        
        // Modal render loop
        const modalLoop = () => {
            if(modalVisible) drawModal();
            requestAnimationFrame(modalLoop);
        };
        modalLoop();

        setInterval(() => {
            // Re-query in case Gradio replaced the DOM element
            const currentOutArea = document.querySelector('#ic_output textarea');
            const text = currentOutArea ? currentOutArea.value : '';
            if (text && text !== lastText && text.startsWith('{')) {
                lastText = text;
                try {
                    const data = JSON.parse(text);
                    if (data.type === 'session_check') {
                        if (data.has_session) {
                            sessionPreview.src = data.preview;
                            sessionModal.style.display = 'flex';
                        }
                    } else if (data.type === 'session_restore' || data.type === 'session_clear') {
                        if (data.image) {
                            bgImage.src = data.image;
                            draw();
                        }
                    } else if (data.type === 'preview') {
                        // Delay applying! Show Modal instead.
                        pendingUpdate = data;
                        previewScale = scale;
                        previewCenterX = (canvas.width / 2 - offsetX) / scale;
                        previewCenterY = (canvas.height / 2 - offsetY) / scale;
                        
                        imagesLoaded = 0;
                        imagesToLoad = 2;
                        pendingPatchImage.src = data.patch;
                        pendingMaskImage.src = data.mask;
                        bgImage.src = data.image; // Base canvas (might have been padded)
                        
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
                        modalOverlay.style.display = 'flex';
                    } else if (data.type === 'project_load') {
                        // Suppress enforceSourceRatio() during the entire load.
                        // Gradio updates gen_width/gen_height sliders asynchronously
                        // after api_load_project returns. Each slider update fires an
                        // 'input' → draw() → enforceSourceRatio(). If only one slider
                        // has been updated, the aspect ratio is temporarily wrong and
                        // enforceSourceRatio() would corrupt the loaded sourceRect.
                        // We suppress for 600ms — enough for all Gradio outputs and
                        // async image loads to settle — then do one final draw() with
                        // enforcement re-enabled.
                        window._ic_project_load_suppress = true;
                        if (window._ic_project_load_timer) clearTimeout(window._ic_project_load_timer);
                        window._ic_project_load_timer = setTimeout(() => {
                            window._ic_project_load_suppress = false;
                            window._ic_project_load_timer = null;
                            draw();
                        }, 600);

                        // Restore viewport FIRST, before any draw() or clearMask()
                        if (data.meta && data.meta.viewport) {
                            const vp = data.meta.viewport;
                            scale = vp.scale;
                            offsetX = vp.offsetX;
                            offsetY = vp.offsetY;
                            sourceRect = vp.sourceRect;
                        }

                        // Eagerly sync gen_width / gen_height to DOM so that
                        // getGenSize() returns correct values even if Gradio hasn't
                        // updated the sliders yet when enforcement resumes.
                        if (data.meta) {
                            if (data.meta.gen_width != null) {
                                const gwEl = document.querySelector('#ic_gen_width input[type="number"]');
                                if (gwEl) gwEl.value = data.meta.gen_width;
                            }
                            if (data.meta.gen_height != null) {
                                const ghEl = document.querySelector('#ic_gen_height input[type="number"]');
                                if (ghEl) ghEl.value = data.meta.gen_height;
                            }
                        }

                        if (data.image) {
                            bgImage.src = data.image;
                        }
                        if (data.mask) {
                            const img = new Image();
                            img.onload = () => {
                                maskDataCanvas.width = img.width;
                                maskDataCanvas.height = img.height;
                                maskDataCtx = maskDataCanvas.getContext('2d', {willReadFrequently: true});
                                maskDataCtx.drawImage(img, 0, 0);
                                resetMaskHistory(); // Reset history after project load
                                draw();
                            };
                            img.src = data.mask;
                        } else {
                            clearMask(); // clearMask already calls saveMaskState
                        }

                        draw();
                    } else if (data.type === 'apply' || data.type === 'discard' || data.image) {
                        // Final update
                        if (data.image) bgImage.src = data.image;
                        draw();
                    } else if (data.type === 'sam_result') {
                        if (data.mask) {
                            const img = new Image();
                            img.onload = () => {
                                maskDataCtx.globalCompositeOperation = 'source-over';
                                maskDataCtx.drawImage(img, 0, 0);
                                saveMaskState(); // Save after Magic Wand stroke for undo
                                draw();
                                document.body.style.cursor = 'default';
                                canvas.style.cursor = 'crosshair';
                            };
                            img.src = data.mask;
                        }
                    } else if (data.type === 'error') {
                        console.error("Backend Error:", data.message);
                        alert("Error: " + data.message);
                        document.body.style.cursor = 'default';
                        canvas.style.cursor = 'crosshair';
                    }
                } catch (e) {
                    console.error("Failed to parse result payload", e);
                }
            }
        }, 100);
    }
