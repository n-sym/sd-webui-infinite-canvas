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
        
        // Draw Image
        if (bgImage.complete && bgImage.naturalWidth > 0) {
            ctx.drawImage(bgImage, 0, 0);
        }
        
        const showOverlays = getShowOverlays();
        if (showOverlays) {
            // Visualize pixel mask as red tint
            if (maskDataCanvas.width > 0 && maskDataCanvas.height > 0) {
                if (tintCanvas.width !== maskDataCanvas.width || tintCanvas.height !== maskDataCanvas.height) {
                    tintCanvas.width = maskDataCanvas.width;
                    tintCanvas.height = maskDataCanvas.height;
                }
                tintCtx.globalCompositeOperation = 'source-over';
                tintCtx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                tintCtx.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
                tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
                tintCtx.globalCompositeOperation = 'destination-in';
                tintCtx.drawImage(maskDataCanvas, 0, 0);
                
                ctx.save();
                const cx = sourceRect.x + sourceRect.w / 2;
                const cy = sourceRect.y + sourceRect.h / 2;
                ctx.translate(cx, cy);
                ctx.rotate(sourceRect.angle || 0);
                ctx.drawImage(tintCanvas, -sourceRect.w/2, -sourceRect.h/2, sourceRect.w, sourceRect.h);
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
            ctx.restore();
        }
        
        ctx.restore();
    }
