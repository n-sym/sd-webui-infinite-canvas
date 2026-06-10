    
    // Bind Mask Tool buttons
    setTimeout(() => {
        const tools = ['rect', 'brush', 'ellipse', 'eraser'];
        tools.forEach(t => {
            const btn = document.getElementById('ic_tool_' + t);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.ic_current_tool = t.charAt(0).toUpperCase() + t.slice(1);
                    
                    // Update classes
                    tools.forEach(t2 => {
                        const b2 = document.getElementById('ic_tool_' + t2);
                        if (b2) {
                            b2.classList.remove('primary');
                            b2.classList.add('secondary');
                        }
                    });
                    btn.classList.remove('secondary');
                    btn.classList.add('primary');
                });
            }
        });
    }, 500);

    // Listen to slider changes instead of polling
    setTimeout(() => {
        const wEl = document.querySelector('#ic_gen_width input[type="number"]');
        const hEl = document.querySelector('#ic_gen_height input[type="number"]');
        if (wEl) wEl.addEventListener('input', () => draw());
        if (hEl) hEl.addEventListener('input', () => draw());
        if (wEl) wEl.addEventListener('change', () => draw());
        if (hEl) hEl.addEventListener('change', () => draw());
        
        const overlayCb = document.querySelector('#ic_show_overlay input[type="checkbox"]');
        if (overlayCb) overlayCb.addEventListener('change', () => draw());
    }, 1000);
    
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const w = screenToWorld(sx, sy);
        
        const inSource = isPointInRect(w.x, w.y, sourceRect);
        
        if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
            if (inSource) {
                isDraggingSource = true;
                dragStartX = w.x - sourceRect.x;
                dragStartY = w.y - sourceRect.y;
            } else {
                isDraggingCanvas = true;
                dragStartX = sx - offsetX;
                dragStartY = sy - offsetY;
            }
            return;
        }
        
        if (e.button === 0 && e.shiftKey) {
            isRotatingSource = true;
            return;
        }
        
        if (e.button === 0) {
            let startX = w.x;
            let startY = w.y;
            let tool = getSelectedMaskTool();
            if (tool === 'Magic') {
                const cx = sourceRect.x + sourceRect.w / 2;
                const cy = sourceRect.y + sourceRect.h / 2;
                const p = rotatePoint(startX, startY, cx, cy, -(sourceRect.angle || 0));
                
                // Point relative to the source rect
                const px = p.x - sourceRect.x;
                const py = p.y - sourceRect.y;
                
                const getCrop = () => {
                    const c = document.createElement('canvas');
                    c.width = sourceRect.w;
                    c.height = sourceRect.h;
                    const cctx = c.getContext('2d');
                    
                    cctx.translate(c.width / 2, c.height / 2);
                    cctx.rotate(-(sourceRect.angle || 0));
                    cctx.translate(-cx, -cy);
                    
                    cctx.drawImage(bgImage, 0, 0);
                    return c.toDataURL('image/jpeg', 0.9);
                };
                
                document.body.style.cursor = 'wait';
                canvas.style.cursor = 'wait';
                
                let dilationValue = parseInt(window.ic_brush_size, 10);
                if (isNaN(dilationValue)) dilationValue = 10;
                
                const payload = {
                    image: getCrop(),
                    points: [[px, py]],
                    dilation: dilationValue
                };
                
                const payloadInput = document.getElementById('ic_sam_payload_input');
                if (payloadInput) {
                    const textarea = payloadInput.querySelector('textarea');
                    if (textarea) {
                        textarea.value = JSON.stringify(payload);
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        setTimeout(() => document.getElementById('ic_sam_predict_btn')?.click(), 50);
                    }
                }
            } else if (tool === 'Rect') {
                isDrawingRect = true;
                currentStroke = {type: 'rect', x: startX, y: startY, w: 0, h: 0};
            } else if (tool === 'Ellipse') {
                isDrawingEllipse = true;
                currentStroke = {type: 'ellipse', x: startX, y: startY, w: 0, h: 0};
            } else if (tool === 'Brush' || tool === 'Eraser') {
                isDrawingBrush = true;
                let baseRadius = parseInt(window.ic_brush_size, 10);
                if (isNaN(baseRadius)) baseRadius = 10;
                if (baseRadius < 1) baseRadius = 1; // Ensure minimum 1 for drawing
                currentStroke = {type: tool.toLowerCase(), radius: baseRadius / scale, lastX: startX, lastY: startY};
                
                const cx = sourceRect.x + sourceRect.w / 2;
                const cy = sourceRect.y + sourceRect.h / 2;
                const p = rotatePoint(startX, startY, cx, cy, -(sourceRect.angle || 0));
                
                maskDataCtx.globalCompositeOperation = tool === 'Eraser' ? 'destination-out' : 'source-over';
                maskDataCtx.fillStyle = 'white';
                maskDataCtx.beginPath();
                maskDataCtx.arc(p.x - sourceRect.x, p.y - sourceRect.y, currentStroke.radius, 0, Math.PI * 2);
                maskDataCtx.fill();
                draw();
            }
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const w = screenToWorld(sx, sy);
        
        const inSource = isPointInRect(w.x, w.y, sourceRect);
        if (isDraggingSource || isDraggingCanvas) {
            canvas.style.cursor = 'move';
        } else if (isRotatingSource || e.shiftKey) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'crosshair';
        }
        
        if (isDraggingCanvas) {
            offsetX = sx - dragStartX;
            offsetY = sy - dragStartY;
            draw();
        } else if (isRotatingSource) {
            canvas.style.cursor = 'grabbing';
            const cx = sourceRect.x + sourceRect.w / 2;
            const cy = sourceRect.y + sourceRect.h / 2;
            let angle = Math.atan2(w.y - cy, w.x - cx);
            // Snap to 0 or PI if close (within ~2.8 degrees)
            if (Math.abs(angle) < 0.05) {
                angle = 0;
            } else if (Math.abs(angle - Math.PI) < 0.05) {
                angle = Math.PI;
            } else if (Math.abs(angle + Math.PI) < 0.05) {
                angle = -Math.PI;
            } else if (Math.abs(angle - Math.PI / 2) < 0.05) {
                angle = Math.PI / 2;
            } else if (Math.abs(angle + Math.PI / 2) < 0.05) {
                angle = -Math.PI / 2;
            }
            sourceRect.angle = angle;
            draw();
        } else if (isDraggingSource) {
            sourceRect.x = w.x - dragStartX;
            sourceRect.y = w.y - dragStartY;
            draw();
        } else if (isDrawingRect || isDrawingEllipse) {
            if (currentStroke) {
                currentStroke.w = w.x - currentStroke.x;
                currentStroke.h = w.y - currentStroke.y;
                draw();
            }
        } else if (isDrawingBrush) {
            if (currentStroke) {
                const cx = sourceRect.x + sourceRect.w / 2;
                const cy = sourceRect.y + sourceRect.h / 2;
                const p1 = rotatePoint(currentStroke.lastX, currentStroke.lastY, cx, cy, -(sourceRect.angle || 0));
                const p2 = rotatePoint(w.x, w.y, cx, cy, -(sourceRect.angle || 0));
                
                maskDataCtx.globalCompositeOperation = currentStroke.type === 'eraser' ? 'destination-out' : 'source-over';
                maskDataCtx.strokeStyle = 'white';
                maskDataCtx.lineWidth = currentStroke.radius * 2;
                maskDataCtx.lineCap = 'round';
                maskDataCtx.lineJoin = 'round';
                maskDataCtx.beginPath();
                maskDataCtx.moveTo(p1.x - sourceRect.x, p1.y - sourceRect.y);
                maskDataCtx.lineTo(p2.x - sourceRect.x, p2.y - sourceRect.y);
                maskDataCtx.stroke();
                
                currentStroke.lastX = w.x;
                currentStroke.lastY = w.y;
                draw();
            }
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        isDraggingCanvas = false;
        isDraggingSource = false;
        isRotatingSource = false;

        let didDrawMask = false;

        if (isDrawingRect || isDrawingEllipse) {
            if (currentStroke) {
                maskDataCtx.globalCompositeOperation = 'source-over';
                maskDataCtx.fillStyle = 'white';

                maskDataCtx.save();
                const mcx = sourceRect.w / 2;
                const mcy = sourceRect.h / 2;
                maskDataCtx.translate(mcx, mcy);
                maskDataCtx.rotate(-(sourceRect.angle || 0));

                const wcx = sourceRect.x + sourceRect.w / 2;
                const wcy = sourceRect.y + sourceRect.h / 2;

                if (currentStroke.type === 'rect') {
                    const offsetX = currentStroke.x - wcx;
                    const offsetY = currentStroke.y - wcy;
                    maskDataCtx.fillRect(offsetX, offsetY, currentStroke.w, currentStroke.h);
                } else if (currentStroke.type === 'ellipse') {
                    maskDataCtx.beginPath();
                    const offsetX = currentStroke.x - wcx + currentStroke.w / 2;
                    const offsetY = currentStroke.y - wcy + currentStroke.h / 2;
                    maskDataCtx.ellipse(
                        offsetX, offsetY,
                        Math.abs(currentStroke.w/2),
                        Math.abs(currentStroke.h/2),
                        0, 0, 2 * Math.PI
                    );
                    maskDataCtx.fill();
                }

                maskDataCtx.restore();
                didDrawMask = true;
            }
            isDrawingRect = false;
            isDrawingEllipse = false;
        } else if (isDrawingBrush) {
            isDrawingBrush = false;
            didDrawMask = true;
        }
        currentStroke = null;

        // Save mask state after each completed stroke for undo
        if (didDrawMask) {
            saveMaskState();
        }

        draw();
    });
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const w = screenToWorld(sx, sy);
        
        const inSource = isPointInRect(w.x, w.y, sourceRect);
        const zoomIntensity = 0.1;
        
        if (inSource) {
            const cx = sourceRect.x + sourceRect.w / 2;
            const cy = sourceRect.y + sourceRect.h / 2;
            let factor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 / (1 + zoomIntensity));
            
            let newW = sourceRect.w * factor;
            let newH = sourceRect.h * factor;
            
            if (!window.ic_ignore_size_limit && (newW > 8192 || newH > 8192)) {
                const modal = document.getElementById('ic-limit-modal');
                if (modal && modal.style.display === 'none') {
                    modal.style.display = 'flex';
                }
                let maxFactorW = 8192 / sourceRect.w;
                let maxFactorH = 8192 / sourceRect.h;
                let allowedFactor = Math.min(maxFactorW, maxFactorH);
                if (allowedFactor < 1) allowedFactor = 1; // Don't shrink if trying to grow
                factor = Math.min(factor, allowedFactor);
                newW = sourceRect.w * factor;
                newH = sourceRect.h * factor;
            }
            
            resizeSourceRect(newW, newH);
        } else {
            const w1 = screenToWorld(sx, sy);
            if (e.deltaY < 0) scale *= (1 + zoomIntensity);
            else scale /= (1 + zoomIntensity);
            const w2 = screenToWorld(sx, sy);
            offsetX += (w2.x - w1.x) * scale;
            offsetY += (w2.y - w1.y) * scale;
        }
        draw();
    });
