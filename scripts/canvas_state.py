import math
import base64
from io import BytesIO
from PIL import Image, ImageDraw

def distance_based_extend(image: Image.Image, mask: Image.Image) -> Image.Image:
    import numpy as np
    from scipy.ndimage import distance_transform_edt
    
    img_arr = np.array(image)
    mask_arr = np.array(mask.convert("L"))
    binary_mask = (mask_arr > 127).astype(np.uint8)
    
    dist, indices = distance_transform_edt(binary_mask, return_indices=True)
    if np.max(dist) == 0:
        return image
        
    extended_arr = img_arr[indices[0], indices[1], :]
    return Image.fromarray(extended_arr)

def distance_based_blur_fill(image: Image.Image, mask: Image.Image) -> Image.Image:
    import cv2
    import numpy as np
    
    img_arr = np.array(image)
    mask_arr = np.array(mask.convert("L"))
    binary_mask = (mask_arr > 0).astype(np.uint8) * 255
    
    # Expand the mask slightly to overwrite any semi-transparent dark anti-aliasing pixels
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary_mask = cv2.dilate(binary_mask, kernel)
    
    # Telea's algorithm (Fast Marching Method) seamlessly propagates colors outwards
    inpainted = cv2.inpaint(img_arr, binary_mask, 3, cv2.INPAINT_TELEA)
    
    # Add a strong Gaussian Blur to the padded area to create a perfect isotropic gradient,
    # eliminating the straight orthogonal streaks produced by Telea.
    blurred = cv2.GaussianBlur(inpainted, (63, 63), 0)
    
    # Composite the original valid pixels back into the center
    valid_mask = (1 - (binary_mask / 255.0))[..., np.newaxis]
    final_arr = inpainted * valid_mask + blurred * (binary_mask / 255.0)[..., np.newaxis]
    final_arr = final_arr.astype(np.uint8)
    
    return Image.fromarray(final_arr)

class CanvasState:
    def __init__(self):
        self.TILE_SIZE = 1024
        self.tiles = {}  # {(tx, ty): PIL.Image}
        self.tiles_prev = None
        self.tiles_now = None
        self.pending_data = None
        self.canvas_bounds = {"x": 0, "y": 0, "w": 1024, "h": 1024}
        self.max_size = 8192
        self.is_dirty = False
        self.current_state = 'now'
        self.workflow = []
        self.step_params = {}

    def clear(self):
        self.tiles = {}
        self.tiles_prev = None
        self.tiles_now = None
        self.pending_data = None
        self.canvas_bounds = {"x": 0, "y": 0, "w": 1024, "h": 1024}
        self.is_dirty = False
        self.workflow = []
        self.step_params = {}

    def _get_tile(self, tx, ty):
        if (tx, ty) not in self.tiles:
            self.tiles[(tx, ty)] = Image.new("RGBA", (self.TILE_SIZE, self.TILE_SIZE), (255, 255, 255, 0))
        return self.tiles[(tx, ty)]

    def _clone_tiles(self, source_tiles):
        if source_tiles is None:
            return None
        return {k: v.copy() for k, v in source_tiles.items()}

    def _update_bounds(self, x, y, w, h):
        cx, cy, cw, ch = self.canvas_bounds['x'], self.canvas_bounds['y'], self.canvas_bounds['w'], self.canvas_bounds['h']
        min_x = min(cx, x)
        min_y = min(cy, y)
        max_x = max(cx + cw, x + w)
        max_y = max(cy + ch, y + h)
        self.canvas_bounds = {"x": min_x, "y": min_y, "w": max_x - min_x, "h": max_y - min_y}

    def update_workflow(self, workflow: list, step_params: dict):
        self.workflow = workflow
        self.step_params = step_params
        
    def update_from_base64(self, base64_str):
        """Updates canvas from an uploaded base64 string (single image)."""
        try:
            if base64_str.startswith('data:image'):
                base64_str = base64_str.split(',')[1]
            image_data = base64.b64decode(base64_str)
            img = Image.open(BytesIO(image_data)).convert("RGBA")
            self.tiles_prev = self._clone_tiles(self.tiles)
            self.tiles = {}
            self.canvas_bounds = {"x": 0, "y": 0, "w": img.width, "h": img.height}
            self._paste_to_tiles(img, 0, 0)
            self.tiles_now = self._clone_tiles(self.tiles)
            self.is_dirty = True
            return True
        except Exception as e:
            print(f"Error updating from base64: {e}")
            return False

    def get_thumbnail_base64(self, max_dim=512):
        if not self.tiles:
            return ""
        # Stitch a thumbnail
        bounds = self.canvas_bounds
        w, h = bounds['w'], bounds['h']
        if w <= 0 or h <= 0:
            return ""
            
        scale = min(1.0, max_dim / max(w, h))
        thumb_w, thumb_h = int(w * scale), int(h * scale)
        if thumb_w == 0 or thumb_h == 0:
            return ""
            
        thumb = Image.new("RGBA", (thumb_w, thumb_h), (255, 255, 255, 0))
        for (tx, ty), tile in self.tiles.items():
            tile_x = tx * self.TILE_SIZE - bounds['x']
            tile_y = ty * self.TILE_SIZE - bounds['y']
            
            scaled_tx = int(tile_x * scale)
            scaled_ty = int(tile_y * scale)
            scaled_tw = int(self.TILE_SIZE * scale)
            scaled_th = int(self.TILE_SIZE * scale)
            
            if scaled_tw > 0 and scaled_th > 0:
                scaled_tile = tile.resize((scaled_tw, scaled_th), Image.LANCZOS)
                thumb.paste(scaled_tile, (scaled_tx, scaled_ty))
                
        buffered = BytesIO()
        thumb.save(buffered, format="PNG", compress_level=1)
        return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

    def get_tiles_payload(self):
        """Returns all tiles as base64 strings."""
        import concurrent.futures
        payload = {"type": "tiles_update", "tiles": []}
        
        def process_tile(tx, ty, tile_img):
            buffered = BytesIO()
            tile_img.save(buffered, format="WEBP", lossless=True, quality=100, method=0)
            b64 = "data:image/webp;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")
            return {"tx": tx, "ty": ty, "data": b64}
            
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [executor.submit(process_tile, tx, ty, tile) for (tx, ty), tile in self.tiles.items()]
            for future in concurrent.futures.as_completed(futures):
                payload["tiles"].append(future.result())
                
        return payload

    def load_image(self, image):
        img = image.convert("RGBA")
        self.tiles = {}
        self.canvas_bounds = {"x": 0, "y": 0, "w": img.width, "h": img.height}
        self._paste_to_tiles(img, 0, 0)
        self.tiles_prev = None
        self.tiles_now = None
        self.current_state = 'now'

    def can_undo(self):
        return self.tiles_prev is not None and self.current_state != 'prev'

    def can_redo(self):
        return self.tiles_now is not None and self.current_state != 'now'

    def _pad_to_include(self, rect):
        """
        Expands bounds if necessary. Since we use negative coordinates freely,
        padding simply means updating the logical bounds. Returns (0,0) as we don't
        shift the origin anymore!
        """
        self._update_bounds(rect['x'], rect['y'], rect['w'], rect['h'])
        return 0, 0

    def _ensure_bounds_cover_tiles(self):
        """Ensures that canvas_bounds is large enough to cover all existing tiles."""
        if not self.tiles:
            return
        min_x = float('inf')
        min_y = float('inf')
        max_x = float('-inf')
        max_y = float('-inf')
        for tx, ty in self.tiles.keys():
            x = tx * self.TILE_SIZE
            y = ty * self.TILE_SIZE
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x + self.TILE_SIZE)
            max_y = max(max_y, y + self.TILE_SIZE)
            
        if min_x != float('inf'):
            self._update_bounds(min_x, min_y, max_x - min_x, max_y - min_y)

    def _extract_from_tiles_for_rect(self, rect):
        import math
        x1, y1 = int(rect['x']), int(rect['y'])
        w, h = int(rect['w']), int(rect['h'])
        x2, y2 = x1 + w, y1 + h
        
        result = Image.new("RGBA", (w, h), (255, 255, 255, 0))
        
        start_tx = math.floor(x1 / self.TILE_SIZE)
        end_tx = math.floor(x2 / self.TILE_SIZE)
        start_ty = math.floor(y1 / self.TILE_SIZE)
        end_ty = math.floor(y2 / self.TILE_SIZE)
        
        for ty in range(start_ty, end_ty + 1):
            for tx in range(start_tx, end_tx + 1):
                if (tx, ty) in self.tiles:
                    tile = self.tiles[(tx, ty)]
                    tile_x = tx * self.TILE_SIZE
                    tile_y = ty * self.TILE_SIZE
                    paste_x = tile_x - x1
                    paste_y = tile_y - y1
                    result.paste(tile, (paste_x, paste_y))
        return result

    def _paste_to_tiles(self, image, global_x, global_y, mask=None):
        import math
        w, h = image.size
        x1, y1 = int(global_x), int(global_y)
        x2, y2 = x1 + w, y1 + h
        
        self._update_bounds(x1, y1, w, h)
        
        start_tx = math.floor(x1 / self.TILE_SIZE)
        end_tx = math.floor(x2 / self.TILE_SIZE)
        start_ty = math.floor(y1 / self.TILE_SIZE)
        end_ty = math.floor(y2 / self.TILE_SIZE)
        
        for ty in range(start_ty, end_ty + 1):
            for tx in range(start_tx, end_tx + 1):
                tile_x = tx * self.TILE_SIZE
                tile_y = ty * self.TILE_SIZE
                
                crop_x1 = max(0, tile_x - x1)
                crop_y1 = max(0, tile_y - y1)
                crop_x2 = min(w, tile_x + self.TILE_SIZE - x1)
                crop_y2 = min(h, tile_y + self.TILE_SIZE - y1)
                
                if crop_x1 < crop_x2 and crop_y1 < crop_y2:
                    crop = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))
                    if mask:
                        crop_mask = mask.crop((crop_x1, crop_y1, crop_x2, crop_y2))
                    else:
                        crop_mask = crop if crop.mode == 'RGBA' else None
                        
                    tile = self._get_tile(tx, ty)
                    paste_x = max(0, x1 - tile_x)
                    paste_y = max(0, y1 - tile_y)
                    tile.paste(crop, (paste_x, paste_y), mask=crop_mask)

    def prepare_generation(self, source_rect, target_rect, generation_res=1024, upscaler_name="None", mask_base64="", auto_scale=True, outpaint_pad="全黑 (Black)"):
        """
        1. Calculates scaling needed so target_rect max dimension matches generation_res.
        2. Upscales canvas if scale > 1 (up to max_size) and auto_scale is True. Does NOT downscale.
        3. Pads canvas if source_rect is out of bounds.
        4. Extracts the source crop.
        5. Returns the cropped image, mask, and new coordinate mappings.
        """
        # Ensure integers
        for k in ['x', 'y', 'w', 'h']:
            source_rect[k] = int(source_rect[k])
            target_rect[k] = int(target_rect[k])
            
        # Capture pre-generation state in case of discard
        self.tiles_prev = self._clone_tiles(self.tiles)
            
        # 1. Scale Canvas if Zoom-in (Target drawn small)
        target_max = max(target_rect['w'], target_rect['h'])
        requested_scale = generation_res / target_max if target_max > 0 else 1.0
        
        self._ensure_bounds_cover_tiles()
        
        actual_canvas_scale = 1.0
        if requested_scale > 1.0 and auto_scale:
            current_max_dim = max(self.canvas_bounds['w'], self.canvas_bounds['h'])
            max_allowed_scale = self.max_size / current_max_dim if current_max_dim > 0 else 1.0
            actual_canvas_scale = min(requested_scale, max_allowed_scale)
            
            if actual_canvas_scale > 1.0:
                bounds = self.canvas_bounds
                w, h = bounds['w'], bounds['h']
                if w > 0 and h > 0:
                    full_img = self._extract_from_tiles_for_rect(bounds)
                    new_w = int(w * actual_canvas_scale)
                    new_h = int(h * actual_canvas_scale)
                    full_img = full_img.resize((new_w, new_h), Image.LANCZOS)
                    self.tiles = {}
                    self.canvas_bounds = {"x": 0, "y": 0, "w": new_w, "h": new_h}
                    self._paste_to_tiles(full_img, int(bounds['x'] * actual_canvas_scale), int(bounds['y'] * actual_canvas_scale))
                
                # Scale coordinates
                for r in [source_rect, target_rect]:
                    for k in ['x', 'y', 'w', 'h']:
                        r[k] = int(r[k] * actual_canvas_scale)

        # 2. Pad canvas if source_rect is out of bounds
        pad_left, pad_top = self._pad_to_include(source_rect)
        
        # 3. Extract source image
        sx, sy, sw, sh = source_rect['x'], source_rect['y'], source_rect['w'], source_rect['h']
        angle = float(source_rect.get('angle', 0.0))
        
        if abs(angle) > 0.001:
            import math
            diagonal = math.ceil(math.sqrt(sw**2 + sh**2))
            cx, cy = sx + sw // 2, sy + sh // 2
            
            large_x1, large_y1 = int(cx - diagonal/2), int(cy - diagonal/2)
            large_x2, large_y2 = int(cx + diagonal/2), int(cy + diagonal/2)
            
            large_rect = {"x": large_x1, "y": large_y1, "w": large_x2 - large_x1, "h": large_y2 - large_y1}
            large_crop = self._extract_from_tiles_for_rect(large_rect)
            
            deg = math.degrees(angle)
            large_rotated = large_crop.rotate(deg, resample=Image.BICUBIC, expand=False)
            
            center_x, center_y = large_rotated.width // 2, large_rotated.height // 2
            source_crop = large_rotated.crop((center_x - sw//2, center_y - sh//2, center_x + sw//2, center_y + sh//2))
        else:
            source_crop = self._extract_from_tiles_for_rect(source_rect)
            
        # 3.5 Apply Edge Padding before resize (since resize drops alpha)
        alpha = None
        is_empty_canvas = False
        if source_crop.mode == 'RGBA':
            alpha = source_crop.split()[3]
            if alpha.getextrema()[1] == 0:
                is_empty_canvas = True
            from PIL import ImageOps, ImageChops
            inverted_alpha = ImageOps.invert(alpha)
            
            bg_color = (0, 0, 0, 255)
            if "White" in outpaint_pad:
                bg_color = (255, 255, 255, 255)
                
            if "Extend Edge" in outpaint_pad or "Edge Blur" in outpaint_pad:
                # DO NOT blend with a black background here! Doing so darkens the anti-aliased edge
                # pixels, causing cv2.inpaint to stretch a dark shadow outwards.
                # Simply converting to RGB drops the alpha, preserving the true RGB color of the edge!
                source_rgb = source_crop.convert("RGB")
                
                if "Edge Blur" in outpaint_pad:
                    source_crop = distance_based_blur_fill(source_rgb, inverted_alpha)
                else:
                    source_crop = distance_based_extend(source_rgb, inverted_alpha)
            else:
                background = Image.new("RGBA", source_crop.size, bg_color)
                background.paste(source_crop, mask=alpha)
                source_crop = background.convert("RGB")
        
        # 4. We must resize source_crop so the model processes it such that Target is generation_res.
        # This is important if requested_scale was clamped by max_size, or if requested_scale < 1.0.
        final_target_max = max(target_rect['w'], target_rect['h'])
        model_scale = generation_res / final_target_max if final_target_max > 0 else 1.0
        
        final_sw = int(source_crop.width * model_scale)
        final_sh = int(source_crop.height * model_scale)
        
        source_ready = source_crop
        if model_scale != 1.0:
            from modules import images
            source_ready = images.resize_image(0, source_crop, final_sw, final_sh, upscaler_name=upscaler_name)
            
        # Also resize inverted_alpha to match final size
        if alpha is not None and model_scale != 1.0:
            inverted_alpha_resized = inverted_alpha.resize((final_sw, final_sh), Image.LANCZOS)
        elif alpha is not None:
            inverted_alpha_resized = inverted_alpha
            
        # 5. Create Mask
        tx_rel = target_rect['x'] - source_rect['x']
        ty_rel = target_rect['y'] - source_rect['y']
        
        mtx = int(tx_rel * model_scale)
        mty = int(ty_rel * model_scale)
        mtw = int(target_rect['w'] * model_scale)
        mth = int(target_rect['h'] * model_scale)
        
        mask = Image.new("L", (final_sw, final_sh), "black")
        from PIL import ImageDraw
        if mask_base64:
            import base64
            from io import BytesIO
            if "," in mask_base64:
                mask_base64 = mask_base64.split(",")[1]
            user_mask = Image.open(BytesIO(base64.b64decode(mask_base64))).convert('L')
            if user_mask.getextrema()[1] == 0:
                # Mask is completely empty (all black), treat as no mask
                draw = ImageDraw.Draw(mask)
                draw.rectangle([mtx, mty, mtx+mtw, mty+mth], fill="white")
            elif mtw > 0 and mth > 0:
                user_mask = user_mask.resize((mtw, mth), Image.LANCZOS)
                mask.paste(user_mask, (mtx, mty))
        else:
            draw = ImageDraw.Draw(mask)
            draw.rectangle([mtx, mty, mtx+mtw, mty+mth], fill="white")
            
        sd_mask = mask.copy()
            
        # Add transparent areas to paste_mask so it gets pasted back to the canvas,
        # but DO NOT add it to sd_mask, so SD doesn't generate over unmasked edge blur!
        from PIL import ImageChops, ImageOps
        if alpha is not None:
            # Binarize and dilate inverted_alpha so that the paste mask fully overwrites
            # the semi-transparent anti-aliased edge seam on the canvas, eliminating the dark border line.
            import numpy as np
            import cv2
            ia_arr = np.array(inverted_alpha_resized)
            ia_arr = (ia_arr > 0).astype(np.uint8) * 255
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            ia_arr = cv2.dilate(ia_arr, kernel)
            solid_inverted_alpha = Image.fromarray(ia_arr)
            
            paste_mask = ImageChops.lighter(mask, solid_inverted_alpha)
        elif source_ready.mode == 'RGBA':
            # Fallback if somehow it's RGBA but we didn't process it earlier
            alpha2 = source_ready.split()[3]
            paste_mask = ImageChops.lighter(mask, ImageOps.invert(alpha2))
            source_ready = source_ready.convert("RGB")
        else:
            paste_mask = mask
            source_ready = source_ready.convert("RGB")
            
        return {
            'image': source_ready,
            'mask': sd_mask,
            'paste_mask': paste_mask,
            'canvas_source_rect': source_rect,
            'model_scale': model_scale,
            'is_empty_canvas': is_empty_canvas,
            'transform': {
                'scale': actual_canvas_scale,
                'pad_left': pad_left,
                'pad_top': pad_top
            }
        }

    def set_pending_result(self, result_image, canvas_source_rect, mask, downscale_algo="Bicubic", edge_fix_mask=None):
        """
        Stores the generated result and mask instead of pasting immediately.
        """
        sw, sh = canvas_source_rect['w'], canvas_source_rect['h']
        algo_map = {"Bicubic": Image.BICUBIC, "Lanczos": Image.LANCZOS, "Bilinear": Image.BILINEAR, "Nearest": Image.NEAREST}
        algo = algo_map.get(downscale_algo, Image.BICUBIC)
        result_resized = result_image.resize((sw, sh), algo) if result_image.size != (sw, sh) else result_image
        mask_resized = (mask.resize((sw, sh), Image.BILINEAR) if mask.size != (sw, sh) else mask).convert("L")
        
        rgba_mask = Image.new("RGBA", mask_resized.size, (255, 255, 255, 0))
        rgba_mask.putalpha(mask_resized)
        
        pending_data = {
            'patch': result_resized,
            'mask_l': mask_resized,
            'mask_rgba': rgba_mask,
            'rect': canvas_source_rect
        }
        
        if edge_fix_mask is not None:
            edge_fix_mask_resized = (edge_fix_mask.resize((sw, sh), Image.BILINEAR) if edge_fix_mask.size != (sw, sh) else edge_fix_mask).convert("L")
            rgba_edge_mask = Image.new("RGBA", edge_fix_mask_resized.size, (255, 255, 255, 0))
            rgba_edge_mask.putalpha(edge_fix_mask_resized)
            pending_data['edge_mask_rgba'] = rgba_edge_mask
            
        self.pending_data = pending_data
        return self.pending_data

    def paste_result(self, result_image, canvas_source_rect, mask=None, downscale_algo="Bicubic"):
        sw, sh = int(canvas_source_rect['w']), int(canvas_source_rect['h'])
        algo_map = {"Bicubic": Image.BICUBIC, "Lanczos": Image.LANCZOS, "Bilinear": Image.BILINEAR, "Nearest": Image.NEAREST}
        algo = algo_map.get(downscale_algo, Image.BICUBIC)
        result_resized = result_image.resize((sw, sh), algo) if result_image.size != (sw, sh) else result_image
        
        angle = float(canvas_source_rect.get('angle', 0.0))
        if mask is not None:
            mask_resized = (mask.resize((sw, sh), Image.BILINEAR) if mask.size != (sw, sh) else mask).convert("L")
        else:
            mask_resized = None
            
        if abs(angle) > 0.001:
            import math
            deg = math.degrees(angle)
            if result_resized.mode != 'RGBA':
                res_rgba = result_resized.convert("RGBA")
            else:
                res_rgba = result_resized
            if mask_resized:
                res_rgba.putalpha(mask_resized)
            rotated_patch = res_rgba.rotate(deg, resample=Image.BICUBIC, expand=True)
            
            cx = canvas_source_rect['x'] + sw // 2
            cy = canvas_source_rect['y'] + sh // 2
            paste_x = cx - rotated_patch.width // 2
            paste_y = cy - rotated_patch.height // 2
            
            self._paste_to_tiles(rotated_patch, paste_x, paste_y, mask=rotated_patch)
        else:
            self._paste_to_tiles(result_resized, canvas_source_rect['x'], canvas_source_rect['y'], mask=mask_resized)
            
        self.tiles_now = self._clone_tiles(self.tiles)
        self.is_dirty = True
        
    def apply_pending_result(self, feather_radius=0):
        if not self.pending_data:
            return
            
        patch = self.pending_data['patch']
        mask = self.pending_data['mask_l']
        rect = self.pending_data['rect']
        
        from PIL import ImageFilter
        if feather_radius > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(feather_radius))
            
        angle = float(rect.get('angle', 0.0))
        
        if abs(angle) > 0.001:
            import math
            deg = math.degrees(angle)
            if patch.mode != 'RGBA':
                res_rgba = patch.convert("RGBA")
            else:
                res_rgba = patch.copy()
            res_rgba.putalpha(mask)
            rotated_patch = res_rgba.rotate(-deg, resample=Image.BICUBIC, expand=True)
            
            cx = rect['x'] + rect['w'] // 2
            cy = rect['y'] + rect['h'] // 2
            paste_x = cx - rotated_patch.width // 2
            paste_y = cy - rotated_patch.height // 2
            
            self._paste_to_tiles(rotated_patch, paste_x, paste_y, mask=rotated_patch)
        else:
            self._paste_to_tiles(patch, rect['x'], rect['y'], mask=mask)
            
        self.tiles_now = self._clone_tiles(self.tiles)
        self.pending_data = None
        self.is_dirty = True
        self.current_state = 'now'

    def discard_pending_result(self):
        self.pending_data = None
        if self.tiles_prev:
            self.tiles = self._clone_tiles(self.tiles_prev)

canvas_state = CanvasState()
