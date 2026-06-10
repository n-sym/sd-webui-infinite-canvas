    function getSelectedMaskTool() {
        return window.ic_current_tool;
    }



    function clearMask() {
        maskDataCanvas.width = Math.max(sourceRect.w, 1);
        maskDataCanvas.height = Math.max(sourceRect.h, 1);
        maskDataCtx = maskDataCanvas.getContext('2d', { willReadFrequently: true });
        maskDataCtx.clearRect(0, 0, maskDataCanvas.width, maskDataCanvas.height);
        targetRect = {x: 0, y: 0, w: 0, h: 0};
        // Save cleared state so the clear itself is undoable
        saveMaskState();
    }

    function resizeSourceRect(newW, newH) {
        const oldX = sourceRect.x;
        const oldY = sourceRect.y;
        
        // Save current mask to temp
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(maskDataCanvas.width, 1);
        tempCanvas.height = Math.max(maskDataCanvas.height, 1);
        tempCanvas.getContext('2d').drawImage(maskDataCanvas, 0, 0);
        
        const cx = sourceRect.x + sourceRect.w / 2;
        const cy = sourceRect.y + sourceRect.h / 2;
        
        // Ensure new dimensions and positions are rounded to integers to avoid drift
        sourceRect.w = Math.round(newW);
        sourceRect.h = Math.round(newH);
        sourceRect.x = Math.round(cx - sourceRect.w / 2);
        sourceRect.y = Math.round(cy - sourceRect.h / 2);
        
        // Resize actual mask canvas
        maskDataCanvas.width = Math.max(sourceRect.w, 1);
        maskDataCanvas.height = Math.max(sourceRect.h, 1);
        maskDataCtx = maskDataCanvas.getContext('2d', { willReadFrequently: true });
        maskDataCtx.clearRect(0, 0, maskDataCanvas.width, maskDataCanvas.height);
        
        // Draw old mask exactly relative to the new integer world coordinates
        const offsetX = oldX - sourceRect.x;
        const offsetY = oldY - sourceRect.y;
        maskDataCtx.drawImage(tempCanvas, offsetX, offsetY);
        
        // targetRect doesn't need to be strictly cleared, but we'll let api re-calculate it on next gen
        targetRect = {x: 0, y: 0, w: 0, h: 0};

        // Save state after resize so it's undoable as one step
        saveMaskState();
    }
    
    const clearMaskBtn = document.getElementById('ic_clear_mask');
    if (clearMaskBtn) {
        clearMaskBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(t("Are you sure you want to clear the mask?"))) {
                clearMask();
                draw();
            }
        });
    }
    
    function saveMaskState() {
        // Trim any "future" states if we're mid-history (user drew after undo)
        if (maskHistoryIndex < maskHistory.length - 1) {
            maskHistory = maskHistory.slice(0, maskHistoryIndex + 1);
        }
        const imageData = maskDataCtx.getImageData(0, 0, maskDataCanvas.width, maskDataCanvas.height);
        // Store mask content alongside sourceRect dimensions so resize is undoable
        maskHistory.push({ imageData, rectW: sourceRect.w, rectH: sourceRect.h });
        // Enforce limit — drop oldest
        if (maskHistory.length > MASK_HISTORY_LIMIT) {
            maskHistory.shift();
        }
        maskHistoryIndex = maskHistory.length - 1;
        updateMaskUndoRedoButtons();
    }

    function restoreMaskState(entry) {
        // Restore sourceRect dimensions, keeping current center position
        // (dragging/rotating are NOT undoable, only dimensions matter)
        const cx = sourceRect.x + sourceRect.w / 2;
        const cy = sourceRect.y + sourceRect.h / 2;
        sourceRect.w = entry.rectW;
        sourceRect.h = entry.rectH;
        sourceRect.x = cx - sourceRect.w / 2;
        sourceRect.y = cy - sourceRect.h / 2;

        // Restore mask canvas content at the historical dimensions
        maskDataCanvas.width = Math.max(entry.rectW, 1);
        maskDataCanvas.height = Math.max(entry.rectH, 1);
        maskDataCtx = maskDataCanvas.getContext('2d', { willReadFrequently: true });
        maskDataCtx.putImageData(entry.imageData, 0, 0);

        updateMaskUndoRedoButtons();
        draw();
    }

    function undoMask() {
        if (maskHistoryIndex <= 0) return;
        maskHistoryIndex--;
        restoreMaskState(maskHistory[maskHistoryIndex]);
    }

    function redoMask() {
        if (maskHistoryIndex >= maskHistory.length - 1) return;
        maskHistoryIndex++;
        restoreMaskState(maskHistory[maskHistoryIndex]);
    }

    function updateMaskUndoRedoButtons() {
        const undoBtn = document.getElementById('ic_float_mask_undo');
        const redoBtn = document.getElementById('ic_float_mask_redo');
        if (undoBtn) {
            if (maskHistoryIndex > 0) undoBtn.classList.remove('disabled-state');
            else undoBtn.classList.add('disabled-state');
        }
        if (redoBtn) {
            if (maskHistoryIndex < maskHistory.length - 1) redoBtn.classList.remove('disabled-state');
            else redoBtn.classList.add('disabled-state');
        }
    }

    function resetMaskHistory() {
        maskHistory = [];
        maskHistoryIndex = -1;
        // Save current state as the new baseline
        saveMaskState();
    }

    function rotatePoint(px, py, cx, cy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = px - cx;
        const dy = py - cy;
        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos
        };
    }
    
    function screenToWorld(sx, sy) {
        return {
            x: (sx - offsetX) / scale,
            y: (sy - offsetY) / scale
        };
    }
    
    function isPointInRect(px, py, rect) {
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        const p = rotatePoint(px, py, cx, cy, -(rect.angle || 0));
        return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
    }
    
    function getGenSize() {
        const wEl = document.querySelector('#ic_gen_width input[type="number"]');
        const hEl = document.querySelector('#ic_gen_height input[type="number"]');
        return {
            w: wEl ? parseFloat(wEl.value) : 1024,
            h: hEl ? parseFloat(hEl.value) : 1024
        };
    }
    
    function enforceSourceRatio() {
        // Suppress during project load to prevent Gradio's async slider
        // updates from overwriting the loaded sourceRect before both
        // gen_width AND gen_height have settled.
        if (window._ic_project_load_suppress) return;

        const size = getGenSize();
        const targetRatio = size.w / size.h;
        const currentRatio = sourceRect.w / sourceRect.h;

        if (Math.abs(targetRatio - currentRatio) > 0.01) {
            const cx = sourceRect.x + sourceRect.w / 2;
            const cy = sourceRect.y + sourceRect.h / 2;
            
            let newW = sourceRect.h * targetRatio;
            let newH = sourceRect.h;
            
            if (!window.ic_ignore_size_limit && (newW > 8192 || newH > 8192)) {
                const modal = document.getElementById('ic-limit-modal');
                if (modal && modal.style.display === 'none') {
                    modal.style.display = 'flex';
                }
                let maxFactorW = 8192 / newW;
                let maxFactorH = 8192 / newH;
                let allowedFactor = Math.min(maxFactorW, maxFactorH);
                newW *= allowedFactor;
                newH *= allowedFactor;
            }
            
            resizeSourceRect(newW, newH);
        }
    }
    
    function calculateTargetRectFromMask() {
        const imgData = maskDataCtx.getImageData(0, 0, maskDataCanvas.width, maskDataCanvas.height);
        const data = imgData.data;
        let minX = maskDataCanvas.width, minY = maskDataCanvas.height, maxX = 0, maxY = 0;
        let found = false;
        for (let y = 0; y < maskDataCanvas.height; y++) {
            for (let x = 0; x < maskDataCanvas.width; x++) {
                const alpha = data[(y * maskDataCanvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }
        if (found) {
            targetRect = {
                x: sourceRect.x + minX,
                y: sourceRect.y + minY,
                w: maxX - minX + 1,
                h: maxY - minY + 1
            };
        } else {
            // Default if nothing drawn
            targetRect = {
                x: sourceRect.x,
                y: sourceRect.y,
                w: sourceRect.w,
                h: sourceRect.h
            };
        }
    }

