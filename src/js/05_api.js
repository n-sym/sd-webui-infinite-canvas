    
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
                let dummyProgressContainer = document.getElementById('ic-dummy-progress');
                if (!dummyProgressContainer) {
                    dummyProgressContainer = document.createElement('div');
                    dummyProgressContainer.id = 'ic-dummy-progress';
                    dummyProgressContainer.style.display = 'none';
                    document.body.appendChild(dummyProgressContainer);
                    
                    let dummyInner = document.createElement('div');
                    dummyInner.id = 'ic-dummy-inner';
                    dummyProgressContainer.appendChild(dummyInner);
                }

                if (typeof requestProgress === 'function') {
                    requestProgress(
                        window.ic_current_task_id,
                        document.getElementById("ic-dummy-inner"),
                        null,
                        function() {
                            window.ic_current_task_id = null;
                            const toast = document.getElementById('ic-progress-toast');
                            if (toast && !window.exist_pending_generation) toast.style.display = 'none';
                            if (typeof showSubmitButtons === 'function' && !window.exist_pending_generation) showSubmitButtons("ic", true);
                        }
                    );
                }
                setTimeout(() => document.getElementById('ic_trigger')?.click(), 100);
            }
        });
    }
    
    const triggerBtn = document.getElementById('ic_trigger');
    
    // Project Management Modal Logic
    const projectsBtn = document.getElementById('ic_float_projects');
    const projectsModal = document.getElementById('ic-projects-modal');
    const projectsList = document.getElementById('ic-projects-list');
    const getProjectsBtn = document.getElementById('ic_get_projects_btn');
    const projectsJsonOutput = document.getElementById('ic_projects_json_output');
    
    if (projectsBtn && projectsModal) {
        projectsBtn.addEventListener('click', () => {
            projectsModal.style.display = 'flex';
            if (getProjectsBtn) getProjectsBtn.click();
        });
    }
    
    if (projectsJsonOutput) {
        const observer = new MutationObserver(() => {
            const textarea = projectsJsonOutput.querySelector('textarea');
            if (!textarea || !textarea.value) return;
            try {
                const projects = JSON.parse(textarea.value);
                textarea.value = "";
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
                    
                    item.addEventListener('click', () => {
                        if (window.ic_is_loading_or_saving) return;
                        window.lockProjectUI();
                        window.ic_pending_autosave_check = true;
                        
                        const nameInput = document.querySelector('#ic_project_name_input textarea') || document.querySelector('#ic_project_name_input input');
                        if (nameInput) {
                            nameInput.value = p.name;
                            if (typeof updateInput === 'function') updateInput(nameInput);
                            else nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            const visualNameInput = document.getElementById('ic-projects-name-input');
                            if (visualNameInput) visualNameInput.value = p.name;
                            
                            // CLEAR autosave output DOM and Gradio state safely to prevent premature firing
                            const autosaveCheckOutput = document.getElementById('ic_check_autosave_output');
                            if (autosaveCheckOutput) {
                                const outArea = autosaveCheckOutput.querySelector('textarea') || autosaveCheckOutput.querySelector('input');
                                if (outArea) {
                                    outArea.value = "";
                                    if (typeof updateInput === 'function') updateInput(outArea);
                                    else outArea.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                            }
                            const checkBtn = document.getElementById('ic_check_autosave_hidden_btn');
                            if (checkBtn) checkBtn.click();
                            
                            projectsModal.style.display = 'none';
                        }
                    });
                    
                    item.appendChild(nameSpan);
                    projectsList.appendChild(item);
                });
            } catch (e) {
                console.error("Error parsing projects JSON", e);
            }
        });
        observer.observe(projectsJsonOutput, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    
    // Autosave check and recovery logic
    const autosaveCheckOutput = document.getElementById('ic_check_autosave_output');
    if (autosaveCheckOutput) {
        const observer = new MutationObserver(() => {
            const textarea = autosaveCheckOutput.querySelector('textarea') || autosaveCheckOutput.querySelector('input');
            if (!textarea || !textarea.value) return;
            if (!window.ic_pending_autosave_check) return;
            window.ic_pending_autosave_check = false;

            try {
                const data = JSON.parse(textarea.value);
                const recoverModal = document.getElementById('ic-recover-modal');
                if (data.has_newer) {
                    if (recoverModal) recoverModal.style.display = 'flex';
                } else {
                    const recoverInput = document.querySelector('#ic_recover_autosave_input input[type="checkbox"]');
                    if (recoverInput) {
                        recoverInput.checked = false;
                        recoverInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    setTimeout(() => {
                        const hiddenLoadBtn = document.getElementById('ic_load_project_hidden_btn');
                        if (hiddenLoadBtn) hiddenLoadBtn.click();
                    }, 100);
                }
            } catch (e) {
                console.error("Error parsing autosave check output", e);
            } 
        });
        observer.observe(autosaveCheckOutput, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    
    const setupRecoverBtn = (btnId, doRecover) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                const recoverModal = document.getElementById('ic-recover-modal');
                if (recoverModal) recoverModal.style.display = 'none';
                
                const recoverInput = document.querySelector('#ic_recover_autosave_input input[type="checkbox"]');
                if (recoverInput) {
                    recoverInput.checked = doRecover;
                    recoverInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                setTimeout(() => {
                    const hiddenLoadBtn = document.getElementById('ic_load_project_hidden_btn');
                    if (hiddenLoadBtn) hiddenLoadBtn.click();
                }, 100);
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
    
    const saveProjectBtn = document.getElementById('ic-projects-save-btn');
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', () => {
            if (window.ic_is_loading_or_saving) return;
            window.lockProjectUI();
            
            const nameField = document.getElementById('ic-projects-name-input');
            const targetName = nameField ? nameField.value : 'project';
            
            const nameInput = document.querySelector('#ic_project_name_input textarea') || document.querySelector('#ic_project_name_input input');
            if (nameInput) {
                nameInput.value = targetName;
                if (typeof updateInput === 'function') updateInput(nameInput);
                else nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            const payload = {
                viewport: {
                    scale: scale,
                    offsetX: offsetX,
                    offsetY: offsetY,
                    sourceRect: sourceRect
                },
                mask: maskDataCanvas.toDataURL('image/png')
            };
            const payloadInput = document.querySelector('#ic_payload textarea') || document.querySelector('#ic_payload input');
            if (payloadInput) {
                if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t("Saving project...") : "Saving project...", 0, 'white', 'ic-save-toast');
                payloadInput.value = JSON.stringify(payload);
                if (typeof updateInput === 'function') updateInput(payloadInput);
                else payloadInput.dispatchEvent(new Event('input', { bubbles: true }));
                const hiddenSaveBtn = document.getElementById('ic_save_project_hidden_btn');
                if (hiddenSaveBtn) hiddenSaveBtn.click();
            }
            projectsModal.style.display = 'none';
        });
    }
    
    const importBtn = document.getElementById('ic-projects-import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (window.ic_is_loading_or_saving) return;
            const hiddenImport = document.querySelector('#ic_import_file input[type="file"]');
            if (hiddenImport) hiddenImport.click();
            projectsModal.style.display = 'none';
        });
    }
    
    const autosaveBtn = document.getElementById('ic_float_autosave');
    if (autosaveBtn) {
        autosaveBtn.addEventListener('click', () => {
            const hiddenAutosave = document.querySelector('#ic_autosave_enable input[type="checkbox"]');
            if (hiddenAutosave) {
                hiddenAutosave.checked = !hiddenAutosave.checked;
                hiddenAutosave.dispatchEvent(new Event('change', { bubbles: true }));
                if (hiddenAutosave.checked) {
                    autosaveBtn.classList.add('primary');
                    if (window.icStartAutosavePoller) window.icStartAutosavePoller();
                } else {
                    autosaveBtn.classList.remove('primary');
                    if (window.autosavePoller) {
                        clearInterval(window.autosavePoller);
                        window.autosavePoller = null;
                    }
                }
            }
        });
        
        // Sync initial state
        setTimeout(() => {
            const hiddenAutosave = document.querySelector('#ic_autosave_enable input[type="checkbox"]');
            if (hiddenAutosave && hiddenAutosave.checked) {
                autosaveBtn.classList.add('primary');
            } else {
                autosaveBtn.classList.remove('primary');
            }
        }, 1000);
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

    function _initICAutosave() {
        const statusBox = document.getElementById('ic_autosave_status_box');
        if (!statusBox) {
            setTimeout(_initICAutosave, 500);
            return;
        }
        
        if (!window.icAutosaveInitialized) {
            window.icAutosaveInitialized = true;
            
            const observer = new MutationObserver(() => {
                const statusInput = statusBox.querySelector('input') || statusBox.querySelector('textarea');
                if (statusInput) {
                    const val = statusInput.value;
                    if (val === 'saving') {
                        if (window.icShowCustomToast) window.icShowCustomToast(typeof t === 'function' ? t("Autosaving...") : "Autosaving...", 0, 'white', 'ic-autosave-toast');
                    } else if (val === 'done') {
                        if (window.icShowCustomToast) {
                            window.icShowCustomToast(typeof t === 'function' ? t("Autosaved successfully!") : "Autosaved successfully!", 3000, 'white', 'ic-autosave-toast');
                            let toast = document.getElementById('ic-autosave-toast');
                            if (toast) {
                                toast.querySelector('.ic-toast-bar').parentNode.style.display = 'none';
                                toast.children[0].style.marginBottom = '0';
                            }
                        }
                    }
                }
            });
            observer.observe(statusBox, { childList: true, subtree: true, attributes: true, characterData: true });
        }
    }
    _initICAutosave();

    window.icStartAutosavePoller = function() {
        if (!window.autosavePoller) {
            window.autosavePoller = setInterval(() => {
                const hiddenAutosave = document.querySelector('#ic_autosave_enable input[type="checkbox"]');
                if (hiddenAutosave && hiddenAutosave.checked) {
                    const btn = document.getElementById('ic_check_autosave_btn');
                    if (btn) btn.click();
                } else {
                    clearInterval(window.autosavePoller);
                    window.autosavePoller = null;
                }
            }, 2000);
        }
    };
    
    // Start it automatically on load if checked
    setTimeout(() => {
        const hiddenAutosave = document.querySelector('#ic_autosave_enable input[type="checkbox"]');
        if (hiddenAutosave && hiddenAutosave.checked) {
            window.icStartAutosavePoller();
        }
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
