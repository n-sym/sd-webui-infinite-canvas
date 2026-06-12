from typing import Any, Dict
import numpy as np
import cv2
from PIL import Image
from scripts.pipeline_types import GenerationStep, GenerationCtx

class EdgeFixStep(GenerationStep):
    id = "edge_fix"
    name = "Edge Fix Post-Process"
    is_plugin = True
    sort_index = 500
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "label": "Enable", "type": "bool", "default": False},
            {"name": "power", "label": "Fix Power", "type": "float", "default": 1.0, "min": 0.0, "max": 2.5, "step": 0.01}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "enabled": bool(raw_params.get("enabled", False)),
            "power": float(raw_params.get("power", 1.0))
        }

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        is_enabled = ctx.var.get("enabled", False)
        power = ctx.var.get("power", 1.0)
        
        # Post-processing steps
        if not ctx.result_img or ctx.mask_gen_size_arr is None or not hasattr(ctx.p, "init_images") or not ctx.p.init_images:
            return ctx
            
        lb_params = ctx.step_params.get("latent_blend", {})
        lb_enabled = lb_params.get("enabled", False)

        original_paste_mask_arr = np.array(ctx.paste_mask.convert("L"))
        
        if lb_enabled and not is_enabled:
            symmetric_soft_mask_resized = cv2.resize(ctx.symmetric_soft_mask_arr, ctx.paste_mask.size, interpolation=cv2.INTER_LINEAR)
            paste_mask_arr = cv2.max(original_paste_mask_arr, symmetric_soft_mask_resized)
            paste_mask_arr[paste_mask_arr > 0] = 255
            ctx.paste_mask = Image.fromarray(paste_mask_arr)
            return ctx
            
        if not is_enabled:
            return ctx

        ctx.edge_fix_power = power # sync

        from modules import shared, processing
        from modules import images as a1111_images
        from scripts.core_logic import ic_process_images
        
        edge_radius = max(1, int(max(ctx.gen_width, ctx.gen_height) * 0.025))
        
        img_in_resized = a1111_images.resize_image(0, ctx.p.init_images[0], ctx.gen_width, ctx.gen_height)
        img_in_arr = np.array(img_in_resized).astype(np.int32)
        img_out_arr = np.array(ctx.result_img).astype(np.int32)
        
        delta = np.abs(img_out_arr - img_in_arr)
        delta_max = np.max(delta, axis=2)
        delta_mask = (delta_max > 5).astype(np.uint8) * 255
        
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        delta_mask = cv2.morphologyEx(delta_mask, cv2.MORPH_OPEN, kernel_open)
        delta_mask = cv2.morphologyEx(delta_mask, cv2.MORPH_CLOSE, kernel_close)
        
        safe_mask = cv2.dilate(ctx.mask_gen_size_arr, np.ones((int(edge_radius)*2+1, int(edge_radius)*2+1), np.uint8))
        actual_mask_arr = cv2.bitwise_and(delta_mask, safe_mask)
        
        if np.max(actual_mask_arr) == 0:
            ctx.blured_edge_mask_arr = np.zeros((ctx.gen_height, ctx.gen_width), dtype=np.uint8)
            ctx.hard_edge_mask_arr = np.zeros((ctx.gen_height, ctx.gen_width), dtype=np.uint8)
        else:
            down_factor = 4
            small_w = max(1, ctx.gen_width // down_factor)
            small_h = max(1, ctx.gen_height // down_factor)
            small_actual = cv2.resize(actual_mask_arr, (small_w, small_h), interpolation=cv2.INTER_NEAREST)
            
            dist_in_eff = cv2.distanceTransform(small_actual, cv2.DIST_L2, 3)
            dist_out_eff = cv2.distanceTransform(cv2.bitwise_not(small_actual), cv2.DIST_L2, 3)
            dist_to_edge = (dist_in_eff + dist_out_eff) * down_factor
            
            sigma = max(1, edge_radius / 3.0)
            edge_mask_float = np.exp(- (dist_to_edge**2) / (2 * sigma**2))
            edge_mask_dist_arr = (edge_mask_float * 255).astype(np.uint8)
            
            large_edge_mask = cv2.resize(edge_mask_dist_arr, (ctx.gen_width, ctx.gen_height), interpolation=cv2.INTER_LINEAR)
            
            blur_k = int(edge_radius) * 2 + 1
            if blur_k % 2 == 0: blur_k += 1
            blured_edge_mask_arr = cv2.GaussianBlur(large_edge_mask, (blur_k, blur_k), 0)
            blured_edge_mask_arr = cv2.GaussianBlur(blured_edge_mask_arr, (blur_k, blur_k), 0)
            ctx.blured_edge_mask_arr = cv2.GaussianBlur(blured_edge_mask_arr, (blur_k, blur_k), 0)
            
            ctx.hard_edge_mask_arr = np.copy(ctx.blured_edge_mask_arr)
            ctx.hard_edge_mask_arr[ctx.hard_edge_mask_arr > 0] = 255
            hard_edge_mask = Image.fromarray(ctx.hard_edge_mask_arr)
            
            p2 = processing.StableDiffusionProcessingImg2Img(
                sd_model=shared.sd_model, outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_img2img_samples, outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_img2img_grids,
                prompt=ctx.prompt, negative_prompt=ctx.negative_prompt, seed=ctx.seed, subseed=-1, subseed_strength=0, seed_resize_from_h=0, seed_resize_from_w=0, seed_enable_extras=False,
                sampler_name=ctx.sampler_name, scheduler=ctx.scheduler, batch_size=1, n_iter=1, steps=max(1, int(ctx.steps * 0.2 * power)),
                cfg_scale=ctx.cfg_scale, distilled_cfg_scale=ctx.shift, width=ctx.gen_width, height=ctx.gen_height, restore_faces=False, tiling=False,
                init_images=[ctx.result_img], mask=hard_edge_mask, mask_blur=4, inpainting_fill=ctx.inpainting_fill_idx, resize_mode=0,
                denoising_strength=(- (ctx.denoising_strength ** 2) / (2 * power) + ctx.denoising_strength), image_cfg_scale=None, inpaint_full_res=False, inpaint_full_res_padding=0, inpainting_mask_invert=0
            )
            p2.script_args = (float(ctx.step_params.get("latent_blend", {}).get("power", 1.0)), )
            
            processed2 = ic_process_images(p2, ctx)
            if processed2.images:
                inpaint_image_2 = processed2.images[0]
                base_arr = np.array(ctx.result_img).astype(np.float32)
                new_arr = np.array(inpaint_image_2).astype(np.float32)
                alpha = (ctx.blured_edge_mask_arr / 255.0)[:, :, np.newaxis]
                final_blended_arr = base_arr * (1.0 - alpha) + new_arr * alpha
                ctx.result_img = Image.fromarray(final_blended_arr.astype(np.uint8))
        
        actual_mask_resized = cv2.resize(actual_mask_arr, ctx.paste_mask.size, interpolation=cv2.INTER_NEAREST)
        hard_edge_mask_resized = cv2.resize(ctx.hard_edge_mask_arr, ctx.paste_mask.size, interpolation=cv2.INTER_LINEAR)
        paste_mask_arr = cv2.max(original_paste_mask_arr, cv2.max(actual_mask_resized, hard_edge_mask_resized))
        paste_mask_arr[paste_mask_arr > 0] = 255
        ctx.paste_mask = Image.fromarray(paste_mask_arr)
        
        return ctx
