    function draw() {
        enforceSourceRatio();
        
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw Image Tiles
        const TILE_SIZE = 1024;
        if (window.ic_tiles) {
            for (const key in window.ic_tiles) {
                const [tx, ty] = key.split(',').map(Number);
                const tileImg = window.ic_tiles[key];
                if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
                    ctx.drawImage(tileImg, tx * TILE_SIZE, ty * TILE_SIZE);
                }
            }
        }
        
        const showOverlays = getShowOverlays();
        if (showOverlays) {
            // Visualize pixel mask as red tint using viewport-sized offscreen canvas
            if (maskDataCanvas.width > 0 && maskDataCanvas.height > 0) {
                if (tintCanvas.width !== canvas.width || tintCanvas.height !== canvas.height) {
                    tintCanvas.width = canvas.width;
                    tintCanvas.height = canvas.height;
                }
                tintCtx.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
                
                tintCtx.save();
                tintCtx.scale(dpr, dpr);
                tintCtx.translate(offsetX, offsetY);
                tintCtx.scale(scale, scale);
                
                const cx = sourceRect.x + sourceRect.w / 2;
                const cy = sourceRect.y + sourceRect.h / 2;
                tintCtx.translate(cx, cy);
                tintCtx.rotate(sourceRect.angle || 0);
                tintCtx.imageSmoothingEnabled = false;
                tintCtx.drawImage(maskDataCanvas, -sourceRect.w/2, -sourceRect.h/2, sourceRect.w, sourceRect.h);
                tintCtx.restore();
                
                tintCtx.globalCompositeOperation = 'source-in';
                tintCtx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
                tintCtx.globalCompositeOperation = 'source-over';
                
                ctx.save();
                ctx.resetTransform();
                ctx.drawImage(tintCanvas, 0, 0);
                ctx.restore();
            }
            
            // Draw current stroke if dragging rect/ellipse
            if (currentStroke && (isDrawingRect || isDrawingEllipse)) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                if (currentStroke.type === 'rect') {
                    ctx.fillRect(currentStroke.x, currentStroke.y, currentStroke.w, currentStroke.h);
                } else if (currentStroke.type === 'ellipse') {
                    ctx.beginPath();
                    ctx.ellipse(
                        currentStroke.x + currentStroke.w/2, 
                        currentStroke.y + currentStroke.h/2, 
                        Math.abs(currentStroke.w/2), 
                        Math.abs(currentStroke.h/2), 
                        0, 0, 2 * Math.PI
                    );
                    ctx.fill();
                }
            }
            
            // Draw Source box (Rotated)
            ctx.save();
            const cx = sourceRect.x + sourceRect.w / 2;
            const cy = sourceRect.y + sourceRect.h / 2;
            ctx.translate(cx, cy);
            ctx.rotate(sourceRect.angle || 0);
            
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
            ctx.lineWidth = 2 / scale;
            ctx.setLineDash([5 / scale, 5 / scale]);
            ctx.strokeRect(-sourceRect.w / 2, -sourceRect.h / 2, sourceRect.w, sourceRect.h);
            
            if (isRotatingSource) {
                // Draw an arrow indicating the "forward/right" direction (X-axis positive)
                ctx.setLineDash([]); // solid line for arrow
                ctx.lineWidth = 3 / scale;
                ctx.beginPath();
                ctx.moveTo(sourceRect.w / 2, 0);
                ctx.lineTo(sourceRect.w / 2 + 25 / scale, 0);
                ctx.lineTo(sourceRect.w / 2 + 15 / scale, -10 / scale);
                ctx.moveTo(sourceRect.w / 2 + 25 / scale, 0);
                ctx.lineTo(sourceRect.w / 2 + 15 / scale, 10 / scale);
                ctx.stroke();
            }
            
            ctx.restore();
        }
        
        ctx.restore();
    }
