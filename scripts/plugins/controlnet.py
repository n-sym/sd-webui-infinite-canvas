import traceback
from typing import Dict, Any
import numpy as np

from scripts.pipeline_types import GenerationStep, GenerationCtx

def _cn_choices(getter, fallback):
    try:
        from lib_controlnet import global_state
        names = getter()
        return names if names else fallback
    except Exception:
        return fallback

class ControlNetStep(GenerationStep):
    id = "controlnet"
    name = "ControlNet"
    is_plugin = True
    sort_index = 40

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": ["SdProcessing", "InputImage", "InputMask"], "out": ["SdProcessing"]}

    @classmethod
    def get_params(cls):
        modules = ["None"] + _cn_choices(lambda: __import__('lib_controlnet').global_state.get_all_preprocessor_names(), ["None"])
        models  = ["None"] + _cn_choices(lambda: __import__('lib_controlnet').global_state.get_all_controlnet_names(), ["None"])
        
        return [
            {"name": "enabled", "label": "Enable", "type": "bool", "default": False, "is_generation_param": False},
            {"name": "module", "label": "Preprocessor", "type": "enum", "choices": modules, "default": "None"},
            {"name": "model", "label": "Model", "type": "enum", "choices": models, "default": "None"},
            {"name": "input_source", "label": "Input", "type": "enum", "choices": ["viewport", "mask"], "default": "viewport"},
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
            
        input_source = ctx.var.get("input_source", "viewport")
        
        try:
            if ctx.mask is not None:
                mask_np = np.array(ctx.mask.convert("L"))
            else:
                mask_np = np.zeros((ctx.gen_height, ctx.gen_width), dtype=np.uint8)
                
            if input_source == "mask":
                if ctx.mask is None:
                    print("[Infinite Canvas] Warning: ControlNet input source set to 'mask' but no mask is present. Skipping ControlNet.")
                    return ctx
                img_np = np.dstack([mask_np, mask_np, mask_np]) # Convert to 3 channel RGB
            else:
                img_np = np.array(ctx.init_image.convert("RGB"))
                
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
            if getattr(ctx.p, "scripts", None) is not None and getattr(ctx.p.scripts, "alwayson_scripts", None) is not None:
                for s in ctx.p.scripts.alwayson_scripts:
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
                            if getattr(ctx.p, "scripts", None) is None:
                                ctx.p.scripts = scripts.ScriptRunner()
                                ctx.p.scripts.alwayson_scripts = []
                            ctx.p.scripts.alwayson_scripts.append(cn_script)
                            break
                        
            if cn_script is None:
                print("[Infinite Canvas] ControlNet script not found in p.scripts - is sd_forge_controlnet enabled?")
                return ctx
                
            args = list(ctx.p.script_args)
            target_idx = getattr(cn_script, "args_from", len(args))
            end_idx = getattr(cn_script, "args_to", target_idx + 1)
            
            if len(args) <= end_idx:
                args += [None] * (end_idx - len(args))
                
            from lib_controlnet.external_code import ControlNetUnit
            for i in range(target_idx, end_idx):
                args[i] = ControlNetUnit(enabled=False)
                
            args[target_idx] = unit
            ctx.p.script_args = tuple(args)
            
        except Exception as e:
            print(f"[Infinite Canvas] Error in ControlNetStep: {e}")
            traceback.print_exc()
            
        return ctx
