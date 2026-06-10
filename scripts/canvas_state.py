import math
import base64
from io import BytesIO
from PIL import Image, ImageDraw

class CanvasState:
    def __init__(self):
        # Initial canvas is 1024x1024 transparent
        self.image = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
        self.image_prev = None
        self.image_now = None
        self.pending_data = None
        self.max_size = 4096  # Configurable max canvas size limit
        self.is_dirty = False

    def clear(self):
        self.image = Image.new("RGBA", (1024, 1024), (255, 255, 255, 0))
        self.image_prev = None
        self.image_now = None
        self.pending_data = None
        self.is_dirty = False
        
    def update_from_base64(self, base64_str):
        """Updates canvas from an uploaded base64 string."""
        try:
            if base64_str.startswith('data:image'):
                base64_str = base64_str.split(',')[1]
            image_data = base64.b64decode(base64_str)
            self.image_prev = self.image.copy()
            self.image = Image.open(BytesIO(image_data)).convert("RGBA")
            self.image_now = self.image.copy()
            self.is_dirty = True
            return True
        except Exception as e:
            print(f"Error updating from base64: {e}")
            return False

    def get_thumbnail_base64(self, max_dim=512):
        if not self.image:
            return ""
        w, h = self.image.width, self.image.height
        if w > max_dim or h > max_dim:
            scale = max_dim / max(w, h)
            thumb = self.image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        else:
            thumb = self.image
        buffered = BytesIO()
        thumb.save(buffered, format="PNG", compress_level=1)
        return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

    def get_base64(self):
        buffered = BytesIO()
        self.image.save(buffered, format="PNG", compress_level=1)
        return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

    def load_image(self, image):
        self.image = image.convert("RGBA")
        self.image_prev = None
        self.image_now = None

    def can_undo(self):
        return self.image_prev is not None

    def can_redo(self):
        return self.image_now is not None

    def _pad_to_include(self, rect):
        """
        Pads the canvas if the rect goes out of bounds.
        Returns (pad_left, pad_top) which are the offsets added.
        """
        x, y, w, h = rect['x'], rect['y'], rect['w'], rect['h']
        
        pad_left = max(0, -x)
        pad_top = max(0, -y)
        pad_right = max(0, (x + w) - self.image.width)
        pad_bottom = max(0, (y + h) - self.image.height)
        
        if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
            new_w = self.image.width + pad_left + pad_right
            new_h = self.image.height + pad_top + pad_bottom
            new_img = Image.new("RGBA", (new_w, new_h), (255, 255, 255, 0))
            new_img.paste(self.image, (pad_left, pad_top))
            self.image = new_img
            
        return pad_left, pad_top

    def prepare_generation(self, source_rect, target_rect, generation_res=1024, upscaler_name="None", mask_base64="", auto_scale=True):
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
        self.image_prev = self.image.copy()
            
        # 1. Scale Canvas if Zoom-in (Target drawn small)
        target_max = max(target_rect['w'], target_rect['h'])
        if target_max <= 0:
            return None
            
        requested_scale = generation_res / target_max
        
        actual_canvas_scale = 1.0
        if requested_scale > 1.0 and auto_scale:
            current_max_dim = max(self.image.width, self.image.height)
            max_allowed_scale = self.max_size / current_max_dim
            actual_canvas_scale = min(requested_scale, max_allowed_scale)
            
            if actual_canvas_scale > 1.0:
                new_w = int(self.image.width * actual_canvas_scale)
                new_h = int(self.image.height * actual_canvas_scale)
                if new_w > 0 and new_h > 0:
                    self.image = self.image.resize((new_w, new_h), Image.LANCZOS)
                
                # Scale coordinates
                for r in [source_rect, target_rect]:
                    for k in ['x', 'y', 'w', 'h']:
                        r[k] = int(r[k] * actual_canvas_scale)

        # 2. Pad canvas if source_rect is out of bounds
        pad_left, pad_top = self._pad_to_include(source_rect)
        
        # Offset rects if padded
        if pad_left > 0 or pad_top > 0:
            for r in [source_rect, target_rect]:
                r['x'] += pad_left
                r['y'] += pad_top
                
        # 3. Extract source image
        sx, sy, sw, sh = source_rect['x'], source_rect['y'], source_rect['w'], source_rect['h']
        angle = float(source_rect.get('angle', 0.0))
        
        if abs(angle) > 0.001:
            import math
            # Calculate the bounding box needed to safely crop the rotated area
            # To ensure we don't crop too tightly and cut off corners during rotation,
            # we crop a larger square based on the diagonal, rotate it, and then crop the exact size.
            diagonal = math.ceil(math.sqrt(sw**2 + sh**2))
            cx, cy = sx + sw // 2, sy + sh // 2
            
            # Crop the large area
            large_x1, large_y1 = int(cx - diagonal/2), int(cy - diagonal/2)
            large_x2, large_y2 = int(cx + diagonal/2), int(cy + diagonal/2)
            
            # We might need to pad again if the diagonal crop is out of bounds
            # For simplicity, let's just use image.crop which automatically pads with 0s if out of bounds in PIL
            large_crop = self.image.crop((large_x1, large_y1, large_x2, large_y2))
            
            # Rotate by negative angle to make the selection straight
            # math.degrees converts radians to degrees. PIL rotates counter-clockwise.
            # In JS, angle is Math.atan2, which is clockwise on screen.
            # So a positive JS angle means clockwise. We want to un-rotate, so counter-clockwise by same amount.
            deg = math.degrees(angle)
            large_rotated = large_crop.rotate(deg, resample=Image.BICUBIC, expand=False)
            
            # Now crop the exact w, h from the center of this rotated large crop
            center_x, center_y = large_rotated.width // 2, large_rotated.height // 2
            source_crop = large_rotated.crop((center_x - sw//2, center_y - sh//2, center_x + sw//2, center_y + sh//2))
        else:
            source_crop = self.image.crop((sx, sy, sx+sw, sy+sh))
        
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
            
        # 5. Create Mask
        tx_rel = target_rect['x'] - source_rect['x']
        ty_rel = target_rect['y'] - source_rect['y']
        
        mtx = int(tx_rel * model_scale)
        mty = int(ty_rel * model_scale)
        mtw = int(target_rect['w'] * model_scale)
        mth = int(target_rect['h'] * model_scale)
        
        mask = Image.new("L", (final_sw, final_sh), "black")
        if mask_base64:
            import base64
            from io import BytesIO
            if "," in mask_base64:
                mask_base64 = mask_base64.split(",")[1]
            user_mask = Image.open(BytesIO(base64.b64decode(mask_base64))).convert('L')
            if mtw > 0 and mth > 0:
                user_mask = user_mask.resize((mtw, mth), Image.LANCZOS)
                mask.paste(user_mask, (mtx, mty))
        else:
            draw = ImageDraw.Draw(mask)
            draw.rectangle([mtx, mty, mtx+mtw, mty+mth], fill="white")
        
        # Add transparent areas to mask and flatten source to RGB
        if source_ready.mode == 'RGBA':
            alpha = source_ready.split()[3]
            from PIL import ImageOps, ImageChops
            inverted_alpha = ImageOps.invert(alpha)
            mask = ImageChops.lighter(mask, inverted_alpha)
            
            # Flatten to RGB with 50% gray background
            background = Image.new("RGBA", source_ready.size, (128, 128, 128, 255))
            background.paste(source_ready, mask=alpha)
            source_ready = background.convert("RGB")
        else:
            source_ready = source_ready.convert("RGB")
            
        return {
            'image': source_ready,
            'mask': mask,
            'canvas_source_rect': source_rect,
            'model_scale': model_scale,
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
        """
        Pastes the generated image back into the global canvas.
        The result_image might be 1024x1024 (or scaled source size), so we resize it 
        back to the physical size of canvas_source_rect in the canvas.
        """
        # (image_prev is now saved in prepare_generation)
        
        sw, sh = canvas_source_rect['w'], canvas_source_rect['h']
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
            
            # Create a transparent RGBA version of the result so we can rotate it with expand=True
            if result_resized.mode != 'RGBA':
                res_rgba = result_resized.convert("RGBA")
            else:
                res_rgba = result_resized
                
            # Put mask into alpha if exists, otherwise full opacity
            if mask_resized:
                res_rgba.putalpha(mask_resized)
                
            # Rotate (expand=True so corners aren't cut off)
            rotated_patch = res_rgba.rotate(deg, resample=Image.BICUBIC, expand=True)
            
            # The paste coordinate needs to be adjusted because expand=True changed the size
            cx = canvas_source_rect['x'] + sw // 2
            cy = canvas_source_rect['y'] + sh // 2
            
            paste_x = cx - rotated_patch.width // 2
            paste_y = cy - rotated_patch.height // 2
            
            # Use the rotated patch's own alpha as the mask for pasting
            self.image.paste(rotated_patch, (paste_x, paste_y), mask=rotated_patch)
        else:
            if mask_resized is not None:
                self.image.paste(result_resized, (canvas_source_rect['x'], canvas_source_rect['y']), mask=mask_resized)
            else:
                self.image.paste(result_resized, (canvas_source_rect['x'], canvas_source_rect['y']))
            
        self.image_now = self.image.copy()
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
            
            self.image.paste(rotated_patch, (paste_x, paste_y), mask=rotated_patch)
        else:
            self.image.paste(patch, (rect['x'], rect['y']), mask=mask)
        self.image_now = self.image.copy()
        self.pending_data = None
        self.is_dirty = True

    def discard_pending_result(self):
        self.pending_data = None
        if self.image_prev:
            self.image = self.image_prev.copy()

canvas_state = CanvasState()
