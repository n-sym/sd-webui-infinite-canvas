    
    // Cleaned up old Gradio listeners
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    const floatingToolbar = document.getElementById('ic-floating-toolbar');
    if (floatingToolbar) {
        floatingToolbar.addEventListener('mouseenter', () => {
            canvas.dispatchEvent(new MouseEvent('mouseup'));
        });
    }
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const w = screenToWorld(sx, sy);
        
        const inSource = isPointInRect(w.x, w.y, sourceRect);
        
        if (e.button === 1) {
            if (e.altKey) {
                // Alt + Middle click: reset blue box position, size, and rotation
                sourceRect.x = 0;
                sourceRect.y = 0;
                if (sourceRect.angle !== undefined) sourceRect.angle = 0;
                
                if (typeof getGenSize === 'function') {
                    const genSize = getGenSize();
                    sourceRect.w = genSize.w;
                    sourceRect.h = genSize.h;
                    if (typeof clearMask === 'function') {
                        clearMask();
                    }
                }
            }
            
            scale = 1;
            offsetX = canvas.width / 2 - (sourceRect.x + sourceRect.w / 2);
            offsetY = canvas.height / 2 - (sourceRect.y + sourceRect.h / 2);
            draw();
            return;
        }
        
        if (e.button === 2 || (e.button === 0 && e.altKey)) {
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
                
                const res = window.ic_getMaskResolution();
                const scaleX = res.w / sourceRect.w;
                const scaleY = res.h / sourceRect.h;
                
                // Point relative to the source rect, scaled to mask resolution
                const px = (p.x - sourceRect.x) * scaleX;
                const py = (p.y - sourceRect.y) * scaleY;
                
                const getCrop = () => {
                    const c = document.createElement('canvas');
                    c.width = res.w;
                    c.height = res.h;
                    const cctx = c.getContext('2d');
                    
                    cctx.scale(scaleX, scaleY);
                    
                    cctx.translate(sourceRect.w / 2, sourceRect.h / 2);
                    cctx.rotate(-(sourceRect.angle || 0));
                    cctx.translate(-cx, -cy);
                    
                    if (window.ic_tiles) {
                        for (const key in window.ic_tiles) {
                            const [tx, ty] = key.split(',').map(Number);
                            const tileImg = window.ic_tiles[key];
                            if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
                                cctx.drawImage(tileImg, tx * 1024, ty * 1024);
                            }
                        }
                    }
                    return c.toDataURL('image/jpeg', 0.9);
                };
                
                document.body.style.cursor = 'wait';
                canvas.style.cursor = 'wait';
                
                let dilationValue = parseInt(window.ic_brush_size, 10);
                if (isNaN(dilationValue)) dilationValue = 10;
                dilationValue = Math.max(1, Math.round(dilationValue * scaleX));
                
                const payload = {
                    image: getCrop(),
                    points: [[px, py]],
                    dilation: dilationValue
                };
                
                fetch('/infinite-canvas-api/sam_predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payload_json: JSON.stringify(payload) })
                }).then(res => res.json())
                  .then(data => {
                      if (window.ic_handle_payload) window.ic_handle_payload(data);
                  })
                  .catch(e => console.error("SAM failed", e));
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
                
                const scaleX = maskDataCanvas.width / sourceRect.w;
                const scaleY = maskDataCanvas.height / sourceRect.h;
                
                maskDataCtx.globalCompositeOperation = tool === 'Eraser' ? 'destination-out' : 'source-over';
                maskDataCtx.fillStyle = 'white';
                maskDataCtx.beginPath();
                maskDataCtx.arc((p.x - sourceRect.x) * scaleX, (p.y - sourceRect.y) * scaleY, currentStroke.radius * scaleX, 0, Math.PI * 2);
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
                
                const scaleX = maskDataCanvas.width / sourceRect.w;
                const scaleY = maskDataCanvas.height / sourceRect.h;
                
                maskDataCtx.globalCompositeOperation = currentStroke.type === 'eraser' ? 'destination-out' : 'source-over';
                maskDataCtx.strokeStyle = 'white';
                maskDataCtx.lineWidth = currentStroke.radius * 2 * scaleX;
                maskDataCtx.lineCap = 'round';
                maskDataCtx.lineJoin = 'round';
                maskDataCtx.beginPath();
                maskDataCtx.moveTo((p1.x - sourceRect.x) * scaleX, (p1.y - sourceRect.y) * scaleY);
                maskDataCtx.lineTo((p2.x - sourceRect.x) * scaleX, (p2.y - sourceRect.y) * scaleY);
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
                const scaleX = maskDataCanvas.width / sourceRect.w;
                const scaleY = maskDataCanvas.height / sourceRect.h;

                maskDataCtx.globalCompositeOperation = 'source-over';
                maskDataCtx.fillStyle = 'white';

                maskDataCtx.save();
                const mcx = maskDataCanvas.width / 2;
                const mcy = maskDataCanvas.height / 2;
                maskDataCtx.translate(mcx, mcy);
                maskDataCtx.rotate(-(sourceRect.angle || 0));

                const wcx = sourceRect.x + sourceRect.w / 2;
                const wcy = sourceRect.y + sourceRect.h / 2;

                if (currentStroke.type === 'rect') {
                    const offsetX = (currentStroke.x - wcx) * scaleX;
                    const offsetY = (currentStroke.y - wcy) * scaleY;
                    maskDataCtx.fillRect(offsetX, offsetY, currentStroke.w * scaleX, currentStroke.h * scaleY);
                } else if (currentStroke.type === 'ellipse') {
                    maskDataCtx.beginPath();
                    const offsetX = (currentStroke.x - wcx + currentStroke.w / 2) * scaleX;
                    const offsetY = (currentStroke.y - wcy + currentStroke.h / 2) * scaleY;
                    maskDataCtx.ellipse(
                        offsetX, offsetY,
                        Math.abs(currentStroke.w/2 * scaleX),
                        Math.abs(currentStroke.h/2 * scaleY),
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
