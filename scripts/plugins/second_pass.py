from typing import Any, Dict
import copy
from scripts.pipeline_types import GenerationStep, GenerationCtx

class SecondPassStep(GenerationStep):
    id = "second_pass"
    name = "Hires Fix"
    is_plugin = True
    sort_index = 102
    
    @classmethod
    def get_params(cls):
        from modules import shared
        return [
            {"name": "enabled", "label": "Enable", "type": "bool", "default": False},
            {"name": "upscaler", "label": "Upscaler", "type": "enum", "choices": [x.name for x in shared.sd_upscalers], "default": shared.sd_upscalers[0].name if shared.sd_upscalers else "None"},
            {"name": "scale_factor", "label": "Scale Factor", "type": "float", "default": 1.5, "min": 1.0, "max": 4.0, "step": 0.05},
            {"name": "overlap", "label": "Tile Overlap", "type": "int", "default": 64, "min": 0, "max": 256, "step": 16},
            {"name": "tile_batch_size", "label": "Tile Batch Size", "type": "int", "default": 1, "min": 1, "max": 8, "step": 1},
            {"name": "steps", "label": "Steps", "type": "int", "default": 15, "min": 1, "max": 100, "step": 1},
            {"name": "denoising_strength", "label": "Denoising Strength", "type": "float", "default": 0.35, "min": 0.0, "max": 1.0, "step": 0.01}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        from modules import shared
        return {
            "enabled": bool(raw_params.get("enabled", False)),
            "upscaler": str(raw_params.get("upscaler", shared.sd_upscalers[0].name if shared.sd_upscalers else "None")),
            "scale_factor": float(raw_params.get("scale_factor", 1.5)),
            "overlap": int(raw_params.get("overlap", 64)),
            "tile_batch_size": int(raw_params.get("tile_batch_size", 1)),
            "steps": int(raw_params.get("steps", 15)),
            "denoising_strength": float(raw_params.get("denoising_strength", 0.35))
        }

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        if not ctx.var.get("enabled", False):
            return ctx
            
        from scripts.sd_upscale import SDUpscale
        
        # Clone processing object to avoid messing up the original params
        p = copy.copy(ctx.p)
        
        # If the original processing was Txt2Img (e.g. starting from an empty canvas), 
        # SD Upscale ignores init_images and denoising_strength. We must cast it to Img2Img.
        import modules.processing as processing
        if p.__class__.__name__ == "StableDiffusionProcessingTxt2Img":
            p.__class__ = processing.StableDiffusionProcessingImg2Img
            p.resize_mode = 0
            p.image_cfg_scale = getattr(p, "image_cfg_scale", None)
            p.mask_blur = 4
            p.mask_round = True
            p.inpainting_fill = 0
            p.inpaint_full_res = False
            p.inpaint_full_res_padding = 0
            p.inpainting_mask_invert = 0
            p.initial_noise_multiplier = getattr(p, "initial_noise_multiplier", 1.0)
            if p.initial_noise_multiplier is None:
                p.initial_noise_multiplier = 1.0
            p.latent_mask = None
            p.force_task_id = getattr(p, "force_task_id", None)
            p.nmask = None
            p.image_conditioning = None
            p.init_img_hash = None
            p.mask_for_overlay = None
            p.init_latent = None

        # Configure new parameters
        p.init_images = [ctx.result_img]
        p.batch_size = ctx.var.get("tile_batch_size", 1)
        p.steps = ctx.var["steps"]
        p.denoising_strength = ctx.var["denoising_strength"]
        # Clear out mask because SD Upscale acts on the whole image (tiles)
        p.mask = None
        p.image_mask = None
        
        # Instantiate and run the built-in SD Upscale script
        sd_upscale = SDUpscale()
        
        processed = sd_upscale.run(
            p=p,
            overlap=ctx.var["overlap"],
            upscaler_index=ctx.var["upscaler"],
            scale_factor=ctx.var["scale_factor"],
            override=False
        )
        
        if processed and processed.images:
            ctx.result_img = processed.images[0]
            print(f"[Second Pass] Completed SD Upscale. Final resolution: {ctx.result_img.size}")
            
        return ctx
