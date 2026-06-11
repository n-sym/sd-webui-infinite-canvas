    
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
        
        function drawBlueBox(ctx, x, y, w, h, scale, angle=0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
            ctx.lineWidth = 2 / scale;
            ctx.setLineDash([5 / scale, 5 / scale]);
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
                    
                    // Helper to populate tiles
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
                    };

                    if (data.type === 'session_check') {
                        if (data.has_session) {
                            sessionPreview.src = data.preview;
                            sessionModal.style.display = 'flex';
                        }
                    } else if (data.type === 'session_restore' || data.type === 'session_clear' || data.type === 'session_cleared' || data.type === 'toggle' || data.type === 'upload' || data.type === 'discard' || data.type === 'apply') {
                        if (data.tiles) {
                            populateTiles(data.tiles);
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
                        modalOverlay.style.display = 'flex';
                    } else if (data.type === 'project_load') {
                        // Suppress enforceSourceRatio() during the entire load.
                        window._ic_project_load_suppress = true;
                        if (window._ic_project_load_timer) clearTimeout(window._ic_project_load_timer);
                        window._ic_project_load_timer = setTimeout(() => {
                            window._ic_project_load_suppress = false;
                            window._ic_project_load_timer = null;
                            draw();
                        }, 600);

                        // Restore viewport FIRST
                        if (data.viewport) {
                            const vp = data.viewport;
                            scale = vp.scale;
                            offsetX = vp.offsetX;
                            offsetY = vp.offsetY;
                            sourceRect = vp.sourceRect;
                        }

                        if (data.tiles) {
                            populateTiles(data.tiles);
                        }
                        
                        if (data.mask) {
                            const img = new Image();
                            img.onload = () => {
                                const res = window.ic_getMaskResolution();
                                maskDataCanvas.width = res.w;
                                maskDataCanvas.height = res.h;
                                maskDataCtx = maskDataCanvas.getContext('2d', {willReadFrequently: true});
                                maskDataCtx.imageSmoothingEnabled = false;
                                maskDataCtx.drawImage(img, 0, 0, maskDataCanvas.width, maskDataCanvas.height);
                                resetMaskHistory(); // Reset history after project load
                                draw();
                            };
                            img.src = data.mask;
                        } else {
                            clearMask(); // clearMask already calls saveMaskState
                        }

                        draw();
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
