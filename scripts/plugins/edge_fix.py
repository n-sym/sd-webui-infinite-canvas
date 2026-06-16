from typing import Any, Dict
import numpy as np
import cv2
from PIL import Image
from scripts.pipeline_types import GenerationStep, GenerationCtx
from scripts.typing_system import *

class EdgeFixStep(GenerationStep):
    id = "edge_fix"
    name = "Edge Fix Post-Process"
    is_plugin = True
    sort_index = 500

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": [GeneratedImage, InputMask], "out": [GeneratedImage]}
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "label": "Enable", "type": "bool", "default": False, "is_generation_param": False},
            {"name": "power", "label": "Fix Power", "type": "float", "default": 1.0, "min": 0.0, "max": 2.5, "step": 0.01}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        def _get(k, default):
            v = raw_params.get(k)
            return default if v is None else v
        return {
            "enabled": bool(_get("enabled", False)),
            "power": float(_get("power", 1.0))
        }

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        is_enabled = ctx.var.get("enabled", False)
        power = ctx.var.get("power", 1.0)
        
        result_img = ctx.get(GeneratedImage)
        mgs = ctx.get(MaskGenSizeArr)
        p = ctx.get(SdProcessing)
        paste_mask = ctx.get(PasteMask)
        res = ctx.get(Resolution)
        sc = ctx.get(SamplerConfig)
        cc = ctx.get(CanvasConfig)
        
        # Post-processing steps
        if not result_img or mgs is None or not hasattr(p, "init_images") or not p.init_images or not res or not paste_mask:
            return ctx
            
        lb_params = ctx.step_params.get("latent_blend", {})
        lb_enabled = lb_params.get("enabled", False)

        original_paste_mask_arr = np.array(paste_mask.convert("L"))
        
        if lb_enabled and not is_enabled:
            sym = ctx.get(SymmetricSoftMaskArr)
            if sym is not None:
                symmetric_soft_mask_resized = cv2.resize(sym, paste_mask.size, interpolation=cv2.INTER_LINEAR)
                paste_mask_arr = cv2.max(original_paste_mask_arr, symmetric_soft_mask_resized)
                paste_mask_arr[paste_mask_arr > 0] = 255
                ctx.set(PasteMask, Image.fromarray(paste_mask_arr))
            return ctx
            
        if not is_enabled:
            return ctx

        ctx.edge_fix_power = power # sync

        from modules import shared, processing
        from modules import images as a1111_images
        from scripts.core_logic import ic_process_images
        
        edge_radius = max(1, int(max(res.gen_width, res.gen_height) * 0.025))
        
        img_in_resized = a1111_images.resize_image(0, p.init_images[0], res.gen_width, res.gen_height)
        img_in_arr = np.array(img_in_resized).astype(np.int32)
        img_out_arr = np.array(result_img).astype(np.int32)
        
        delta = np.abs(img_out_arr - img_in_arr)
        delta_max = np.max(delta, axis=2)
        delta_mask = (delta_max > 5).astype(np.uint8) * 255
        
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        delta_mask = cv2.morphologyEx(delta_mask, cv2.MORPH_OPEN, kernel_open)
        delta_mask = cv2.morphologyEx(delta_mask, cv2.MORPH_CLOSE, kernel_close)
        
        safe_mask = cv2.dilate(mgs, np.ones((int(edge_radius)*2+1, int(edge_radius)*2+1), np.uint8))
        actual_mask_arr = cv2.bitwise_and(delta_mask, safe_mask)
        
        blured_edge_mask_arr = None
        hard_edge_mask_arr = None
        
        if np.max(actual_mask_arr) == 0:
            blured_edge_mask_arr = np.zeros((res.gen_height, res.gen_width), dtype=np.uint8)
            hard_edge_mask_arr = np.zeros((res.gen_height, res.gen_width), dtype=np.uint8)
            ctx.set(BluredEdgeMaskArr, blured_edge_mask_arr)
            ctx.set(HardEdgeMaskArr, hard_edge_mask_arr)
        else:
            down_factor = 4
            small_w = max(1, res.gen_width // down_factor)
            small_h = max(1, res.gen_height // down_factor)
            small_actual = cv2.resize(actual_mask_arr, (small_w, small_h), interpolation=cv2.INTER_NEAREST)
            
            dist_in_eff = cv2.distanceTransform(small_actual, cv2.DIST_L2, 3)
            dist_out_eff = cv2.distanceTransform(cv2.bitwise_not(small_actual), cv2.DIST_L2, 3)
            dist_to_edge = (dist_in_eff + dist_out_eff) * down_factor
            
            sigma = max(1, edge_radius / 3.0)
            edge_mask_float = np.exp(- (dist_to_edge**2) / (2 * sigma**2))
            edge_mask_dist_arr = (edge_mask_float * 255).astype(np.uint8)
            
            large_edge_mask = cv2.resize(edge_mask_dist_arr, (res.gen_width, res.gen_height), interpolation=cv2.INTER_LINEAR)
            
            blur_k = int(edge_radius) * 2 + 1
            if blur_k % 2 == 0: blur_k += 1
            blured_edge_mask_arr = cv2.GaussianBlur(large_edge_mask, (blur_k, blur_k), 0)
            blured_edge_mask_arr = cv2.GaussianBlur(blured_edge_mask_arr, (blur_k, blur_k), 0)
            blured_edge_mask_arr = cv2.GaussianBlur(blured_edge_mask_arr, (blur_k, blur_k), 0)
            ctx.set(BluredEdgeMaskArr, blured_edge_mask_arr)
            
            hard_edge_mask_arr = np.copy(blured_edge_mask_arr)
            hard_edge_mask_arr[hard_edge_mask_arr > 0] = 255
            ctx.set(HardEdgeMaskArr, hard_edge_mask_arr)
            hard_edge_mask = Image.fromarray(hard_edge_mask_arr)
            
            prompt = ctx.get(Prompt) or ""
            neg = ctx.get(NegativePrompt) or ""
            
            p2 = processing.StableDiffusionProcessingImg2Img(
                sd_model=shared.sd_model, outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_img2img_samples, outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_img2img_grids,
                prompt=prompt, negative_prompt=neg, seed=sc.seed, subseed=-1, subseed_strength=0, seed_resize_from_h=0, seed_resize_from_w=0, seed_enable_extras=False,
                sampler_name=sc.sampler_name, scheduler=sc.scheduler, batch_size=1, n_iter=1, steps=max(1, int(sc.steps * 0.2 * power)),
                cfg_scale=sc.cfg_scale, distilled_cfg_scale=sc.shift, width=res.gen_width, height=res.gen_height, restore_faces=False, tiling=False,
                init_images=[result_img], mask=hard_edge_mask, mask_blur=4, inpainting_fill=["fill", "original", "latent noise", "latent nothing"].index(cc.inpainting_fill) if cc.inpainting_fill in ["fill", "original", "latent noise", "latent nothing"] else 1, resize_mode=0,
                denoising_strength=(- (sc.denoising_strength ** 2) / (2 * power) + sc.denoising_strength), image_cfg_scale=None, inpaint_full_res=False, inpaint_full_res_padding=0, inpainting_mask_invert=0
            )
            p2.script_args = (float(ctx.step_params.get("latent_blend", {}).get("power", 1.0)), )
            
            processed2 = ic_process_images(p2, ctx)
            if processed2.images:
                inpaint_image_2 = processed2.images[0]
                base_arr = np.array(result_img).astype(np.float32)
                new_arr = np.array(inpaint_image_2).astype(np.float32)
                alpha = (blured_edge_mask_arr / 255.0)[:, :, np.newaxis]
                final_blended_arr = base_arr * (1.0 - alpha) + new_arr * alpha
                ctx.set(GeneratedImage, Image.fromarray(final_blended_arr.astype(np.uint8)))
        
        actual_mask_resized = cv2.resize(actual_mask_arr, paste_mask.size, interpolation=cv2.INTER_NEAREST)
        hard_edge_mask_resized = cv2.resize(hard_edge_mask_arr, paste_mask.size, interpolation=cv2.INTER_LINEAR)
        paste_mask_arr = cv2.max(original_paste_mask_arr, cv2.max(actual_mask_resized, hard_edge_mask_resized))
        paste_mask_arr[paste_mask_arr > 0] = 255
        ctx.set(PasteMask, Image.fromarray(paste_mask_arr))
        
        return ctx
