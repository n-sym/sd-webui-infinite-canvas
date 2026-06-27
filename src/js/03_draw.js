let drawRafId = null;
    let isDrawingRafPending = false;
    
    function ic_getMipmap(tileImg, targetSize) {
        if (!tileImg.mipmaps) tileImg.mipmaps = {};
        if (tileImg.mipmaps[targetSize] && tileImg.mipmaps[targetSize] !== 'pending') {
            return tileImg.mipmaps[targetSize];
        }
        
        // Start async background generation of the mipmap
        if (tileImg.mipmaps[targetSize] === undefined) {
            tileImg.mipmaps[targetSize] = 'pending';
            
            createImageBitmap(tileImg, {
                resizeWidth: targetSize,
                resizeHeight: targetSize,
                resizeQuality: 'medium'
            }).then(bitmap => {
                tileImg.mipmaps[targetSize] = bitmap;
                if (typeof window.ic_draw === 'function') {
                    window.ic_draw();
                } else if (typeof draw === 'function') {
                    draw();
                }
            }).catch(err => {
                console.warn("[Infinite Canvas] Failed to generate mipmap:", err);
                tileImg.mipmaps[targetSize] = null;
            });
        }
        
        // Fallback: Find the closest available mipmap
        let fallback = null;
        let closestDiff = Infinity;
        for (const size in tileImg.mipmaps) {
            if (tileImg.mipmaps[size] && tileImg.mipmaps[size] !== 'pending') {
                const diff = Math.abs(parseInt(size) - targetSize);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    fallback = tileImg.mipmaps[size];
                }
            }
        }
        
        return fallback;
        
        // Handled completely in the updated block above
    }
    
    function ic_drawTiles(ctx, visibleWorldLeft, visibleWorldTop, visibleWorldRight, visibleWorldBottom, currentScale) {
        const TILE_SIZE = 1024;
        if (!window.ic_tiles) return;
        
        for (const key in window.ic_tiles) {
            const [tx, ty] = key.split(',').map(Number);
            
            const tileLeft = tx * TILE_SIZE;
            const tileTop = ty * TILE_SIZE;
            const tileRight = tileLeft + TILE_SIZE;
            const tileBottom = tileTop + TILE_SIZE;
            
            // Frustum cull
            if (tileRight < visibleWorldLeft || tileLeft > visibleWorldRight || 
                tileBottom < visibleWorldTop || tileTop > visibleWorldBottom) {
                continue;
            }
            
            const tileImg = window.ic_tiles[key];
            if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
                let mipmapSize = 1024;
                if (currentScale !== undefined) {
                    if (currentScale <= 0.125) mipmapSize = 128;
                    else if (currentScale <= 0.25) mipmapSize = 256;
                    else if (currentScale <= 0.5) mipmapSize = 512;
                }
                
                if (mipmapSize < 1024) {
                    const mipmapCanvas = ic_getMipmap(tileImg, mipmapSize);
                    if (mipmapCanvas) {
                        ctx.drawImage(mipmapCanvas, tileLeft, tileTop, TILE_SIZE, TILE_SIZE);
                    } else {
                        // Crucial performance fix: Do NOT draw the original 1024 tileImg when heavily zoomed out!
                        // That would force the browser to synchronously decode 128 Base64 strings, locking the CPU for 6+ seconds.
                        // Instead, draw a lightweight placeholder. It will be replaced by the Mipmap asynchronously in ~100ms.
                        ctx.fillStyle = 'rgba(128, 128, 128, 0.2)';
                        ctx.fillRect(tileLeft, tileTop, TILE_SIZE, TILE_SIZE);
                    }
                } else {
                    // Crucial trick: Append to DOM to prevent Chrome from aggressively garbage-collecting the decoded pixel buffer
                    if (!tileImg.ic_appended) {
                        tileImg.ic_appended = true;
                        tileImg.ic_tile_key = key;
                        let pool = document.getElementById('ic_img_pool');
                        if (!pool) {
                            pool = document.createElement('div');
                            pool.id = 'ic_img_pool';
                            pool.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-9999;overflow:hidden;top:0;left:0;';
                            document.body.appendChild(pool);
                        }
                        pool.appendChild(tileImg);
                    }
                    ctx.drawImage(tileImg, tileLeft, tileTop);
                }
            }
        }
        
        // Garbage collect orphaned images from the DOM pool
        const pool = document.getElementById('ic_img_pool');
        if (pool) {
            for (let i = pool.children.length - 1; i >= 0; i--) {
                const img = pool.children[i];
                const k = img.ic_tile_key;
                if (!k || !window.ic_tiles || window.ic_tiles[k] !== img) {
                    pool.removeChild(img);
                    img.ic_appended = false;
                    img.src = '';
                }
            }
        }
    }

    function draw() {
        if (!isDrawingRafPending) {
            isDrawingRafPending = true;
            requestAnimationFrame(() => {
                isDrawingRafPending = false;
                _drawImpl();
            });
        }
    }

    function _drawImpl() {
        enforceSourceRatio();
        
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Sync CSS Background Grid (Photoshop style)
        const container = document.getElementById('ic-container');
        if (container) {
            const bgSize = 32 * scale;
            const halfSize = 16 * scale;
            container.style.backgroundSize = `${bgSize}px ${bgSize}px`;
            container.style.backgroundPosition = `${offsetX}px ${offsetY}px, ${offsetX + halfSize}px ${offsetY + halfSize}px`;
        }
        
        // Calculate visible world rect for frustum culling
        const visibleWorldLeft = -offsetX / scale;
        const visibleWorldTop = -offsetY / scale;
        const visibleWorldRight = (canvas.width / dpr - offsetX) / scale;
        const visibleWorldBottom = (canvas.height / dpr - offsetY) / scale;

        ic_drawTiles(ctx, visibleWorldLeft, visibleWorldTop, visibleWorldRight, visibleWorldBottom, scale);
        
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
            const genSize = typeof getGenSize === 'function' ? getGenSize() : {w: 1024, h: 1024};
            const angle = sourceRect.angle || 0;
            if (Math.abs(sourceRect.w - genSize.w) < 1 && Math.abs(sourceRect.h - genSize.h) < 1 && Math.abs(angle) < 0.001) {
                ctx.setLineDash([]);
            } else {
                ctx.setLineDash([5 / scale, 5 / scale]);
            }
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
            
            if (window.ic_show_debug_info) {
                ctx.save();
                ctx.setLineDash([]);
                const ratioW = sourceRect.w / genSize.w;
                const ratioH = sourceRect.h / genSize.h;
                const ratio = ((ratioW + ratioH) / 2).toFixed(2);
                const text = `Logical: ${Math.round(sourceRect.w)}x${Math.round(sourceRect.h)} | Gen: ${genSize.w}x${genSize.h} | Scale: ${ratio}`;
                
                ctx.font = `${14 / scale}px Arial`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                
                const padding = 5 / scale;
                const textW = ctx.measureText(text).width;
                const textH = 16 / scale;
                
                const textX = sourceRect.w / 2 - padding;
                const textY = -sourceRect.h / 2 - padding;
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(textX - textW - padding, textY - textH, textW + padding * 2, textH + padding);
                
                ctx.fillStyle = '#00FFCC';
                ctx.fillText(text, textX, textY);
                ctx.restore();
            }
            
            ctx.restore();
        }
        
        ctx.restore();
    }
