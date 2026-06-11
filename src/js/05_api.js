    
    const generateBtn = document.getElementById('ic_generate');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
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
            
            const payloadInput = document.querySelector('#ic_payload textarea');
            if (payloadInput) {
                payloadInput.value = JSON.stringify(payload);
                payloadInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                window.ic_current_task_id = "task(" + Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7) + ")";
                if (typeof showSubmitButtons === 'function') showSubmitButtons("ic", false);
                if (typeof requestProgress === 'function') {
                    requestProgress(
                        window.ic_current_task_id,
                        document.getElementById("ic-container"),
                        null,
                        function() {
                            if (typeof showSubmitButtons === 'function') showSubmitButtons("ic", true);
                        }
                    );
                }
                setTimeout(() => document.getElementById('ic_trigger')?.click(), 100);
            }
        });
    }
    
    const triggerBtn = document.getElementById('ic_trigger');
    
    // Project Save/Load Logic
    const saveProjectBtn = document.getElementById('ic_save_project_btn');
    const loadProjectBtn = document.getElementById('ic_load_project_btn');
    const uploadFileInput = document.getElementById('ic_upload_file');
    
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', () => {
            const payload = {
                viewport: {
                    scale: scale,
                    offsetX: offsetX,
                    offsetY: offsetY,
                    sourceRect: sourceRect
                },
                mask: maskDataCanvas.toDataURL('image/png')
            };
            const payloadInput = document.querySelector('#ic_payload');
            const textarea = payloadInput.querySelector('textarea');
            if (textarea) {
                textarea.value = JSON.stringify(payload);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                const hiddenSaveBtn = document.getElementById('ic_save_project_hidden_btn');
                if (hiddenSaveBtn) hiddenSaveBtn.click();
            }
        });
    }
    
    if (loadProjectBtn && uploadFileInput) {
        loadProjectBtn.addEventListener('click', () => {
            // Re-query uploadFileInput — Gradio replaces the DOM element after
            // each upload, so the cached reference becomes detached.
            const fileContainer = document.getElementById('ic_upload_file');
            const realInput = fileContainer ? fileContainer.querySelector('input[type="file"]') : null;
            if (realInput) {
                // Clear previous selection so the same file re-triggers the change event
                realInput.value = '';
                // Clear #ic_output so the polling loop always detects the new payload,
                // even when loading the same project file again
                const outArea = document.querySelector('#ic_output textarea');
                if (outArea) outArea.value = '';
                realInput.click();
            }
        });
    }

    if (!triggerBtn) return;
    
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
            
            const autoScaleCb = document.querySelector('#ic_auto_scale input[type="checkbox"]');
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
