import traceback
from typing import Dict, Any
import numpy as np

from scripts.pipeline_types import GenerationStep, GenerationCtx
from scripts.typing_system import *

def _cn_choices(getter, fallback):
    try:
        from lib_controlnet import global_state
        names = getter()
        return names if names else fallback
    except Exception:
        return fallback

class SdControlNetStep(GenerationStep):
    id = "sd_controlnet"
    name = "SD ControlNet"
    is_plugin = True
    sort_index = 40

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": [SdProcessing, Var[..., Image3], Var[..., Image1]], "out": [SdProcessing]}

    @classmethod
    def get_params(cls, pipeline=None):
        modules = ["None"] + _cn_choices(lambda: __import__('lib_controlnet').global_state.get_all_preprocessor_names(), ["None"])
        models  = ["None"] + _cn_choices(lambda: __import__('lib_controlnet').global_state.get_all_controlnet_names(), ["None"])
        
        image_choices = []
        mask_choices = []
        
        if pipeline is not None:
            from scripts.pipeline_types import get_pipeline_choices
            image_choices = get_pipeline_choices(pipeline, cls.sort_index, Var[..., Image3])
            mask_choices = get_pipeline_choices(pipeline, cls.sort_index, Var[..., Image1])
            if not image_choices: image_choices = []
            if not mask_choices: mask_choices = []
        
        return [
            {"name": "enabled", "label": "Enable", "type": "bool", "default": False, "is_generation_param": False},
            {"name": "module", "label": "Preprocessor", "type": "enum", "choices": modules, "default": "None"},
            {"name": "model", "label": "Model", "type": "enum", "choices": models, "default": "None"},
            {"name": "image_input", "label": "Image Input", "type": "enum", "choices": image_choices, "default": image_choices[0]},
            {"name": "mask_input", "label": "Mask Input", "type": "enum", "choices": mask_choices, "default": mask_choices[0]},
            {"name": "weight", "label": "Weight", "type": "float", "default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05},
            {"name": "guidance_start", "label": "Start", "type": "float", "default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01},
            {"name": "guidance_end", "label": "End", "type": "float", "default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01},
            {"name": "resize_mode", "label": "Resize Mode", "type": "enum", "choices": ["Just Resize", "Crop and Resize", "Resize and Fill"], "default": "Crop and Resize"},
            {"name": "control_mode", "label": "Control Mode", "type": "enum", "choices": ["Balanced", "My prompt is more important", "ControlNet is more important"], "default": "Balanced"},
            {"name": "processor_res", "label": "Processor Res", "type": "int", "default": 512, "min": 64, "max": 2048, "step": 64},
            {"name": "pixel_perfect", "label": "Pixel Perfect", "type": "bool", "default": False},
        ]

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        if not ctx.var.get("enabled", False):
            return ctx
            
        module_name = ctx.var.get("module", "None")
        model_name = ctx.var.get("model", "None")
        
        if module_name == "None" and model_name == "None":
            return ctx
            
        image_source = ctx.var.get("image_input", "InputImage")
        mask_source = ctx.var.get("mask_input", "InputMask")
        
        available_images = ctx.filter(Var[..., Image3])
        available_masks = ctx.filter(Var[..., Image1])
        
        # Fallback to last available if requested not found
        if image_source not in available_images and available_images:
            image_source = list(available_images.keys())[-1]
            
        if mask_source not in available_masks and available_masks:
            mask_source = list(available_masks.keys())[-1]
            
        img_obj = available_images.get(image_source)
        mask_obj = available_masks.get(mask_source)
        
        res = ctx.get(Resolution)
        p = ctx.get(SdProcessing)
        
        if not res or not p:
            return ctx
            
        try:
            if mask_obj is not None:
                mask_np = np.array(mask_obj.convert("L"))
            else:
                mask_np = np.zeros((res.gen_height, res.gen_width), dtype=np.uint8)
                
            if img_obj is not None:
                img_np = np.array(img_obj.convert("RGB"))
            else:
                img_np = np.zeros((res.gen_height, res.gen_width, 3), dtype=np.uint8)
                
            unit_image = {"image": img_np, "mask": mask_np}
                
            from lib_controlnet.external_code import ControlNetUnit
            unit = ControlNetUnit(
                enabled=True,
                module=module_name,
                model=model_name,
                image=unit_image,
                weight=float(ctx.var.get("weight", 1.0)),
                guidance_start=float(ctx.var.get("guidance_start", 0.0)),
                guidance_end=float(ctx.var.get("guidance_end", 1.0)),
                resize_mode=ctx.var.get("resize_mode", "Crop and Resize"),
                control_mode=ctx.var.get("control_mode", "Balanced"),
                processor_res=int(ctx.var.get("processor_res", 512)),
                pixel_perfect=bool(ctx.var.get("pixel_perfect", False))
            )
            
            cn_script = None
            if getattr(p, "scripts", None) is not None and getattr(p.scripts, "alwayson_scripts", None) is not None:
                for s in p.scripts.alwayson_scripts:
                    if s.title() == "ControlNet":
                        cn_script = s
                        break
                        
            if cn_script is None:
                from modules import scripts
                if hasattr(scripts, "scripts_img2img") and scripts.scripts_img2img:
                    global_titles = [s.title() for s in scripts.scripts_img2img.alwayson_scripts]
                    print(f"[Infinite Canvas] Available global scripts: {global_titles}")
                    for s in scripts.scripts_img2img.alwayson_scripts:
                        if s.title() == "ControlNet":
                            cn_script = s
                            if getattr(p, "scripts", None) is None:
                                p.scripts = scripts.ScriptRunner()
                                p.scripts.alwayson_scripts = []
                            p.scripts.alwayson_scripts.append(cn_script)
                            break
                        
            if cn_script is None:
                print("[Infinite Canvas] ControlNet script not found in p.scripts - is sd_forge_controlnet enabled?")
                return ctx
                
            args = list(p.script_args)
            target_idx = getattr(cn_script, "args_from", len(args))
            end_idx = getattr(cn_script, "args_to", target_idx + 1)
            
            if len(args) <= end_idx:
                args += [None] * (end_idx - len(args))
                
            from lib_controlnet.external_code import ControlNetUnit
            for i in range(target_idx, end_idx):
                args[i] = ControlNetUnit(enabled=False)
                
            args[target_idx] = unit
            p.script_args = tuple(args)
            
        except Exception as e:
            print(f"[Infinite Canvas] Error in ControlNetStep: {e}")
            traceback.print_exc()
            
        return ctx
