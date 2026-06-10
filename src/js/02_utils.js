    function getSelectedMaskTool() {
        return window.ic_current_tool;
    }



    function clearMask() {
        maskDataCanvas.width = Math.max(sourceRect.w, 1);
        maskDataCanvas.height = Math.max(sourceRect.h, 1);
        maskDataCtx = maskDataCanvas.getContext('2d', { willReadFrequently: true });
        maskDataCtx.clearRect(0, 0, maskDataCanvas.width, maskDataCanvas.height);
        targetRect = {x: 0, y: 0, w: 0, h: 0};
    }

    function resizeSourceRect(newW, newH) {
        const oldW = maskDataCanvas.width;
        const oldH = maskDataCanvas.height;
        
        // Save current mask to temp
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(oldW, 1);
        tempCanvas.height = Math.max(oldH, 1);
        tempCanvas.getContext('2d').drawImage(maskDataCanvas, 0, 0);
        
        const cx = sourceRect.x + sourceRect.w / 2;
        const cy = sourceRect.y + sourceRect.h / 2;
        
        sourceRect.w = newW;
        sourceRect.h = newH;
        sourceRect.x = cx - sourceRect.w / 2;
        sourceRect.y = cy - sourceRect.h / 2;
        
        // Resize actual mask canvas
        maskDataCanvas.width = Math.max(sourceRect.w, 1);
        maskDataCanvas.height = Math.max(sourceRect.h, 1);
        maskDataCtx = maskDataCanvas.getContext('2d', { willReadFrequently: true });
        maskDataCtx.clearRect(0, 0, maskDataCanvas.width, maskDataCanvas.height);
        
        // Draw old mask back in the center to keep it aligned with the canvas background
        const offsetX = (maskDataCanvas.width - oldW) / 2;
        const offsetY = (maskDataCanvas.height - oldH) / 2;
        maskDataCtx.drawImage(tempCanvas, offsetX, offsetY);
        
        // targetRect doesn't need to be strictly cleared, but we'll let api re-calculate it on next gen
        targetRect = {x: 0, y: 0, w: 0, h: 0};
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

