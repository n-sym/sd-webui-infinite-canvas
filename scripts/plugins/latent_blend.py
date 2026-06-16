from typing import Any, Dict
import torch
import cv2
import PIL.Image
from modules import scripts
from scripts.pipeline_types import GenerationStep, GenerationCtx
from scripts.typing_system import *

def float64(t):
    return t.to(torch.float64) if t.dtype != torch.float64 else t

class ICLatentBlendScript(scripts.Script):
    def title(self):
        return "IC Latent Blend"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def run(self, p, *args):
        pass

    def on_mask_blend(self, p, mba, *args):
        if not getattr(p, 'ic_latent_blend_active', False):
            return

        a = mba.init_latent
        b = mba.current_latent
        t = mba.nmask
        
        power = args[0] if len(args) > 0 else 0.0
        if power > 0.0:
            sigma = mba.sigma[0] if getattr(mba, 'sigma', None) is not None else 1.0
            t = torch.pow(t, sigma ** power)

        if t.ndim == 3: t = t.unsqueeze(0)
        if a.ndim == 5 and t.ndim == 4: t = t.unsqueeze(2)

        one_minus_t = 1 - t
        image_interp = a * one_minus_t + b * t
        
        detail = 4.0
        
        current_magnitude = torch.norm(image_interp, p=2, dim=1, keepdim=True).to(float64(image_interp)).add_(0.00001)
        a_magnitude = torch.norm(a, p=2, dim=1, keepdim=True).to(float64(a)).pow_(detail) * one_minus_t
        b_magnitude = torch.norm(b, p=2, dim=1, keepdim=True).to(float64(b)).pow_(detail) * t
        
        desired_magnitude = a_magnitude.add_(b_magnitude).pow_(1 / detail)
        scale = desired_magnitude.div_(current_magnitude).to(image_interp.dtype)
        image_interp.mul_(scale)

        mba.blended_latent = image_interp


class LatentBlendStep(GenerationStep):
    id = "latent_blend"
    name = "Latent Edge Blend"
    is_plugin = True
    sort_index = 30

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": [Resolution, InputMask], "out": [SdProcessing]}
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "label": "Enable", "type": "bool", "default": False, "is_generation_param": False},
            {"name": "power", "label": "Blend Power", "type": "float", "default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01}
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
        if not ctx.var.get("enabled", False):
            return ctx
            
        res = ctx.get(Resolution)
        mgs = ctx.get(MaskGenSizeArr)
        p = ctx.get(SdProcessing)
        
        if not res or mgs is None or not p:
            return ctx
            
        blend_power = ctx.var.get("power", 1.0)
        
        edge_radius = max(1, int(max(res.gen_width, res.gen_height) * 0.025))
        ksize = int(edge_radius) * 2 + 1
        sym = cv2.GaussianBlur(mgs, (ksize, ksize), 0)
        ctx.set(SymmetricSoftMaskArr, sym)
        
        p.image_mask = PIL.Image.fromarray(sym)
        p.mask_round = False
        p.ic_latent_blend_active = True
        ic_script = ICLatentBlendScript()
        ic_script.args_from = len(p.script_args)
        ic_script.args_to = len(p.script_args)
        if getattr(p, "scripts", None) is not None and getattr(p.scripts, "alwayson_scripts", None) is not None:
            p.scripts.alwayson_scripts.append(ic_script)
        elif getattr(p, "scripts", None) is None:
            from modules.scripts import ScriptRunner
            p.scripts = ScriptRunner()
            p.scripts.alwayson_scripts = [ic_script]
            
        return ctx
