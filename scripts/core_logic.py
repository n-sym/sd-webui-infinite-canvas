import os
import json
import base64
import torch
import numpy as np
import cv2
import concurrent.futures
import zipfile
import re
from io import BytesIO
from PIL import Image, ImageOps, ImageFilter
from typing import Any, Optional, Dict
from dataclasses import dataclass, field
import traceback
import gradio as gr
from modules import processing, shared, scripts
from modules.torch_utils import float64
from scripts.canvas_state import canvas_state

def build_js():
    try:
        extension_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
        src_js_dir = os.path.join(extension_dir, 'src', 'js')
        out_js_file = os.path.join(extension_dir, 'javascript', 'infinite_canvas.js')

        if os.path.exists(src_js_dir):
            js_files = sorted([f for f in os.listdir(src_js_dir) if f.endswith('.js')])
            merged_code = []
            for f in js_files:
                with open(os.path.join(src_js_dir, f), 'r', encoding='utf-8') as infile:
                    merged_code.append(infile.read())
                    
            with open(out_js_file, 'w', encoding='utf-8') as outfile:
                outfile.write("\n\n".join(merged_code))
            print("\n[Infinite Canvas] Rebuilt javascript/infinite_canvas.js from src/js/")
            return "JS rebuilt successfully!"
        return "JS source directory not found."
    except Exception as e:
        print("[Infinite Canvas] Failed to build JS:", e)
        return f"Failed to build JS: {e}"


sam2_model = None



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



@dataclass
class GenerationCtx:
    # 1. Original Inputs
    id_task: str = ""
    payload_json: str = ""
    prompt: str = ""
    negative_prompt: str = ""
    steps: int = 20
    cfg_scale: float = 7.0
    shift: float = 3.0
    denoising_strength: float = 0.6
    sampler_name: str = "Euler a"
    scheduler: str = "Automatic"
    gen_width: int = 1024
    gen_height: int = 1024
    seed: int = -1
    inpainting_fill_idx: int = 1
    outpaint_pad: str = "Black"
    upscaler_name: str = "None"
    auto_scale: bool = False
    downscale_algo: str = "Bicubic"

    # Dictionary-driven namespace for modules
    step_params: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    var: Dict[str, Any] = field(default_factory=dict)  # Injected during pipeline loop

    # 2. Extracted from Payload
    source_rect: Dict = field(default_factory=dict)
    target_rect: Dict = field(default_factory=dict)
    mask_base64: str = ""

    # 3. Canvas Prep
    generation_res: int = 1024
    init_image: Optional[Any] = None
    mask: Optional[Any] = None
    paste_mask: Optional[Any] = None
    canvas_source_rect: Dict = field(default_factory=dict)
    prep_info: Dict = field(default_factory=dict)

    # 4. Processing Object (A1111)
    p: Optional[Any] = None

    # 5. Intermediate/Final Masks & Images
    mask_gen_size_arr: Optional[Any] = None
    symmetric_soft_mask_arr: Optional[Any] = None
    result_img: Optional[Any] = None
    blured_edge_mask_arr: Optional[Any] = None
    actual_mask_arr: Optional[Any] = None
    hard_edge_mask_arr: Optional[Any] = None

    # 6. Outputs
    final_payload: str = ""
    is_error: bool = False
    error_message: str = ""


class GenerationStep:
    id: str = "base_step"
    name: str = "Base Step"
    is_plugin: bool = False
    sort_index: int = 500
    
    @classmethod
    def get_params(cls) -> list[Dict[str, Any]]:
        return []
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return raw_params

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        return ctx


class ParseInputStep(GenerationStep):
    id = "parse_input"
    sort_index = 0
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        global sam2_model
        if sam2_model is not None:
            print("[Infinite Canvas] Freeing SAM 2 model to save VRAM for generation...")
            del sam2_model
            sam2_model = None
            import gc
            gc.collect()
            try:
                from modules import devices
                devices.torch_gc()
            except:
                pass

        data = json.loads(ctx.payload_json)
        ctx.source_rect = data.get('source_rect', {})
        ctx.target_rect = data.get('target_rect', {})
        ctx.mask_base64 = data.get('mask_base64', '')
        
        ctx.seed = int(ctx.seed) if ctx.seed is not None else -1
        ctx.shift = float(ctx.shift) if ctx.shift is not None else 3.0
        ctx.gen_width = int(ctx.gen_width) if ctx.gen_width is not None else 1024
        ctx.gen_height = int(ctx.gen_height) if ctx.gen_height is not None else 1024
        ctx.inpainting_fill_idx = int(ctx.inpainting_fill_idx) if ctx.inpainting_fill_idx is not None else 1
        ctx.outpaint_pad = str(ctx.outpaint_pad) if ctx.outpaint_pad is not None else "Black"
        ctx.auto_scale = bool(ctx.auto_scale)
        
        ctx.generation_res = max(ctx.gen_width, ctx.gen_height)
        
        ctx.workflow = data.get("workflow", [])
        payload_step_params = data.get("step_params", {})
        
        plugins = [cls for cls in GenerationStep.__subclasses__() if getattr(cls, 'is_plugin', False)]
        
        for plugin_cls in plugins:
            if plugin_cls.id in payload_step_params:
                resolved = plugin_cls.resolve_params(payload_step_params[plugin_cls.id])
                if plugin_cls.id not in ctx.step_params:
                    ctx.step_params[plugin_cls.id] = {}
                ctx.step_params[plugin_cls.id].update(resolved)
            
        canvas_state.update_workflow(ctx.workflow, ctx.step_params)
        
        return ctx


class PrepareCanvasStep(GenerationStep):
    id = "prepare_canvas"
    name = "Core: Prep Canvas"
    sort_index = 10
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        prep_info = canvas_state.prepare_generation(
            ctx.source_rect, ctx.target_rect, 
            generation_res=ctx.generation_res, 
            upscaler_name=ctx.upscaler_name, 
            mask_base64=ctx.mask_base64, 
            auto_scale=ctx.auto_scale, 
            outpaint_pad=ctx.outpaint_pad
        )
        if not prep_info:
            ctx.final_payload = json.dumps(canvas_state.get_tiles_payload())
            ctx.is_error = True # Stop pipeline without throwing an error
            return ctx
            
        ctx.prep_info = prep_info
        ctx.init_image = prep_info['image']
        ctx.mask = prep_info['mask']
        ctx.paste_mask = prep_info.get('paste_mask', ctx.mask)
        ctx.canvas_source_rect = prep_info['canvas_source_rect']
        return ctx


class LLMPromptOptimizeStep(GenerationStep):
    id = "llm_prompt_optimizer"
    name = "LLM Prompt Optimizer"
    is_plugin = True
    sort_index = 15
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "type": "bool", "label": "Enable", "default": False},
            {"name": "api_url", "type": "string", "label": "API URL", "default": "https://api.deepseek.com/chat/completions"},
            {"name": "api_key", "type": "password", "label": "API Key", "default": ""},
            {"name": "model", "type": "string", "label": "Model Name", "default": "deepseek-v4-flash"},
            {"name": "prefix_tags", "type": "string", "label": "Prefix Tags", "default": "safe, year 2025, newest, masterpiece, best quality, score_9, score_8"},
            {"name": "character_tags", "type": "string", "label": "Character & Series", "default": ""},
            {"name": "style_tags", "type": "string", "label": "Artist & Style", "default": ""}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "enabled": bool(raw_params.get("enabled", False)),
            "api_url": str(raw_params.get("api_url", "https://api.openai.com/v1/chat/completions")),
            "api_key": str(raw_params.get("api_key", "")),
            "model": str(raw_params.get("model", "gpt-3.5-turbo")),
            "prefix_tags": str(raw_params.get("prefix_tags", "safe, year 2025, newest, masterpiece, best quality, score_9, score_8")),
            "character_tags": str(raw_params.get("character_tags", "")),
            "style_tags": str(raw_params.get("style_tags", ""))
        }
        
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        is_enabled = ctx.var.get("enabled", False)
        if not is_enabled or not ctx.prompt:
            return ctx
            
        import re
        import requests
        
        # Extract and remove LoRAs
        loras = re.findall(r'<lora:[^>]+>', ctx.prompt)
        content_prompt = re.sub(r'<lora:[^>]+>', '', ctx.prompt).strip()
        
        # Optimize content
        api_url = ctx.var.get("api_url", "")
        api_key = ctx.var.get("api_key", "")
        model = ctx.var.get("model", "")
        optimized_content = content_prompt
        
        if api_key and content_prompt:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            char_tags = ctx.var.get("character_tags", "")
            style_tags = ctx.var.get("style_tags", "")
            
            system_prompt = f"""Enhance the user's text into a comma-separated list of highly detailed stable diffusion tags. Reply ONLY with the tags.
CRITICAL RULES:
1. DO NOT add any quality tags (e.g., masterpiece, best quality, highres).
2. DO NOT add "close-up" unless the user explicitly asks for it.
3. The following character and style tags will be automatically combined with your output. DO NOT copy or include them in your output, just use them as context for your generation:
[Context - Characters]: {char_tags if char_tags else 'None'}
[Context - Style]: {style_tags if style_tags else 'None'}
"""
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content_prompt}
                ]
            }
            try:
                print(f"[LLM Optimizer] Sending to LLM: {content_prompt}")
                response = requests.post(api_url, headers=headers, json=payload, timeout=15)
                response.raise_for_status()
                optimized_content = response.json()['choices'][0]['message']['content'].strip()
                print(f"[LLM Optimizer] Received optimized: {optimized_content}")
            except Exception as e:
                print(f"[LLM Optimizer] Failed to optimize: {e}")
        
        # Reconstruct final prompt
        parts = []
        for p in [ctx.var.get("prefix_tags", ""), ctx.var.get("character_tags", ""), ctx.var.get("style_tags", ""), optimized_content]:
            p = p.strip()
            if p:
                parts.append(p)
                
        final_prompt = ", ".join(parts)
        if loras:
            final_prompt += " " + " ".join(loras)
            
        ctx.prompt = final_prompt
        return ctx


class AppendCloseUpStep(GenerationStep):
    id = "append_close_up"
    name = "Append Close-Up"
    is_plugin = True
    sort_index = 18
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "type": "bool", "label": "Enable", "default": False}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "enabled": bool(raw_params.get("enabled", False))
        }
        
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        is_enabled = ctx.var.get("enabled", False)
        if is_enabled and ctx.prompt:
            ctx.prompt = ctx.prompt.rstrip()
            if not ctx.prompt.endswith(","):
                ctx.prompt += ","
            ctx.prompt += " close-up"
            print(f"[Append Close-Up] Appended to prompt: {ctx.prompt}")
        return ctx


class SetupProcessingStep(GenerationStep):
    id = "setup_processing"
    name = "Core: Setup SD"
    sort_index = 20
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        p = processing.StableDiffusionProcessingImg2Img(
            sd_model=shared.sd_model,
            outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_img2img_samples,
            outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_img2img_grids,
            prompt=ctx.prompt,
            negative_prompt=ctx.negative_prompt,
            styles=[],
            seed=ctx.seed,
            subseed=-1,
            subseed_strength=0,
            seed_resize_from_h=0,
            seed_resize_from_w=0,
            seed_enable_extras=False,
            sampler_name=ctx.sampler_name,
            scheduler=ctx.scheduler,
            batch_size=1,
            n_iter=1,
            steps=ctx.steps,
            cfg_scale=ctx.cfg_scale,
            distilled_cfg_scale=ctx.shift,
            width=ctx.gen_width,
            height=ctx.gen_height,
            restore_faces=False,
            tiling=False,
            init_images=[ctx.init_image],
            mask=ctx.mask,
            mask_blur=4,
            inpainting_fill=ctx.inpainting_fill_idx,
            resize_mode=0,
            denoising_strength=ctx.denoising_strength,
            image_cfg_scale=None,
            inpaint_full_res=False,
            inpaint_full_res_padding=0,
            inpainting_mask_invert=0,
        )
        p.script_args = (float(ctx.step_params.get("latent_blend", {}).get("power", 1.0)), )
        p.extra_generation_params["IC Upscaler"] = ctx.upscaler_name
        p.extra_generation_params["IC Auto Scale"] = ctx.auto_scale
        ctx.p = p
        
        # Prepare edge masks
        edge_fix_params = ctx.step_params.get("edge_fix", {})
        latent_blend_params = ctx.step_params.get("latent_blend", {})
        if edge_fix_params.get("enabled", False) or latent_blend_params.get("enabled", False):
            ctx.mask_gen_size_arr = cv2.resize(np.array(ctx.mask), (ctx.gen_width, ctx.gen_height), interpolation=cv2.INTER_NEAREST)
            
        return ctx


class LatentBlendStep(GenerationStep):
    id = "latent_blend"
    name = "Latent Edge Blend"
    is_plugin = True
    sort_index = 30
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "label": "Enable", "type": "bool", "default": False},
            {"name": "power", "label": "Blend Power", "type": "float", "default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "enabled": bool(raw_params.get("enabled", False)),
            "power": float(raw_params.get("power", 1.0))
        }

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        if not ctx.var.get("enabled", False):
            return ctx
            
        blend_power = ctx.var.get("power", 1.0)
        ctx.latent_blend_power = blend_power  # sync for later scripts
        
        edge_radius = max(1, int(max(ctx.gen_width, ctx.gen_height) * 0.025))
        ksize = int(edge_radius) * 2 + 1
        ctx.symmetric_soft_mask_arr = cv2.GaussianBlur(ctx.mask_gen_size_arr, (ksize, ksize), 0)
        
        ctx.p.image_mask = Image.fromarray(ctx.symmetric_soft_mask_arr)
        ctx.p.mask_round = False
        ctx.p.ic_latent_blend_active = True
        ic_script = ICLatentBlendScript()
        ic_script.args_from = len(ctx.p.script_args)
        ic_script.args_to = len(ctx.p.script_args)
        if getattr(ctx.p, "scripts", None) is not None and getattr(ctx.p.scripts, "alwayson_scripts", None) is not None:
            ctx.p.scripts.alwayson_scripts.append(ic_script)
        elif getattr(ctx.p, "scripts", None) is None:
            from modules.scripts import ScriptRunner
            ctx.p.scripts = ScriptRunner()
            ctx.p.scripts.alwayson_scripts = [ic_script]
            
        return ctx


def ic_process_images(p, ctx):
    compile_preset = getattr(ctx, "compile_preset", "Disable")
    if compile_preset != "Disable":
        try:
            actual_preset = compile_preset
            TorchCompileForForge = None
            from modules import scripts
            for script_data in scripts.scripts_data:
                if script_data.script_class.__name__ == "TorchCompileForForge":
                    TorchCompileForForge = script_data.script_class
                    break
            
            if TorchCompileForForge is None:
                raise ImportError("TorchCompileForForge not found in global scripts.")
            
            class HackCompileScript(scripts.Script):
                def title(self): return "Hack Compile"
                def show(self, is_img2img): return scripts.AlwaysVisible
                def process_batch(self, p_inner, *args, **kwargs):
                    print(f"[Infinite Canvas] Torch Compile Adapter: Applying '{actual_preset}'...")
                    self.compiler = TorchCompileForForge()
                    self.compiler.process_batch(p_inner, preset=actual_preset)
                    
                def postprocess(self, p_inner, processed, *args):
                    if hasattr(self, "compiler"):
                        self.compiler.process_batch(p_inner, preset="Disable")
                        print("[Infinite Canvas] Torch Compile Adapter: Restored UNet.")
                        
            hack_script = HackCompileScript()
            hack_script.args_from = len(p.script_args) if p.script_args else 0
            hack_script.args_to = hack_script.args_from
            if getattr(p, "scripts", None) is not None and getattr(p.scripts, "alwayson_scripts", None) is not None:
                p.scripts.alwayson_scripts.append(hack_script)
            elif getattr(p, "scripts", None) is None:
                from modules.scripts import ScriptRunner
                p.scripts = ScriptRunner()
                p.scripts.alwayson_scripts = [hack_script]
        except Exception as e:
            print(f"[Infinite Canvas] Torch Compile Adapter failed to load: {e}")

    return processing.process_images(p)

class FirstPassStep(GenerationStep):
    id = "first_pass"
    name = "Core: Generation"
    sort_index = 100
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        processed = ic_process_images(ctx.p, ctx)
            
        if processed.images:
            ctx.result_img = processed.images[0]
        else:
            ctx.is_error = True
            ctx.error_message = "No images returned from first pass."
        return ctx


class EdgeFixStep(GenerationStep):
    id = "edge_fix"
    name = "Edge Fix Post-Process"
    is_plugin = True
    sort_index = 110
    
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
        if not ctx.result_img or ctx.mask_gen_size_arr is None:
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

        from modules import images as a1111_images
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


class FinalizeStateStep(GenerationStep):
    id = "finalize_state"
    name = "Core: Finalize"
    sort_index = 1000
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        if not ctx.result_img:
            return ctx
            
        edge_fix_mask_img = Image.fromarray(ctx.blured_edge_mask_arr) if ctx.blured_edge_mask_arr is not None else None
        canvas_state.set_pending_result(ctx.result_img, ctx.canvas_source_rect, ctx.paste_mask, ctx.downscale_algo, edge_fix_mask=edge_fix_mask_img)
        
        def to_b64(img):
            buffered = BytesIO()
            img.save(buffered, format="PNG", compress_level=1)
            return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")
            
        patch_b64 = to_b64(canvas_state.pending_data['patch'])
        mask_b64 = to_b64(canvas_state.pending_data['mask_rgba'])
        edge_mask_b64 = to_b64(canvas_state.pending_data['edge_mask_rgba']) if 'edge_mask_rgba' in canvas_state.pending_data else None
        
        payload = canvas_state.get_tiles_payload()
        payload["type"] = "preview"
        payload["patch"] = patch_b64
        payload["mask"] = mask_b64
        payload["transform"] = {
            "scale": ctx.prep_info['transform']['scale'],
            "pad_left": ctx.prep_info['transform']['pad_left'],
            "pad_top": ctx.prep_info['transform']['pad_top'],
            "rect_x": ctx.canvas_source_rect['x'],
            "rect_y": ctx.canvas_source_rect['y']
        }
        if edge_mask_b64:
            payload["edge_mask"] = edge_mask_b64
            
        ctx.final_payload = json.dumps(payload)
        return ctx


def api_generate(id_task, payload_json, prompt, negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill_idx, outpaint_pad, upscaler_name, auto_scale, downscale_algo, compile_preset="Disable"):
    ctx = GenerationCtx(
        id_task=id_task, payload_json=payload_json, prompt=prompt, negative_prompt=negative_prompt,
        steps=steps, cfg_scale=cfg_scale, shift=shift, denoising_strength=denoising_strength,
        sampler_name=sampler_name, scheduler=scheduler, gen_width=gen_width, gen_height=gen_height,
        seed=seed, inpainting_fill_idx=inpainting_fill_idx, outpaint_pad=outpaint_pad,
        upscaler_name=upscaler_name, auto_scale=auto_scale, downscale_algo=downscale_algo
    )
    ctx.compile_preset = compile_preset
    
    pipeline = [
        ParseInputStep(),
        PrepareCanvasStep(),
        LLMPromptOptimizeStep(),
        AppendCloseUpStep(),
        SetupProcessingStep(),
        LatentBlendStep(),
        FirstPassStep(),
        EdgeFixStep(),
        FinalizeStateStep()
    ]
    
    try:
        for step in pipeline:
            if step.id not in ctx.step_params:
                ctx.step_params[step.id] = {}
            ctx.var = ctx.step_params[step.id]
            
            ctx = step(ctx)
            if ctx.is_error or ctx.final_payload != "":
                break
    except Exception as e:
        traceback.print_exc()
        ctx.is_error = True
        ctx.error_message = str(e)
        
    if ctx.is_error and ctx.error_message != "":
        return "", gr.update(), gr.update(), f"Error: {ctx.error_message}"
        
    if ctx.final_payload:
        return ctx.final_payload, gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo()), ""
        
    return "", gr.update(), gr.update(), ""


def api_apply(feather_radius):
    try:
        feather = float(feather_radius)
        canvas_state.apply_pending_result(feather)
        payload = canvas_state.get_tiles_payload()
        payload["type"] = "preview"
        payload["is_discard"] = True
        return json.dumps(payload), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())
    except Exception as e:
        import traceback
        traceback.print_exc()
        return "", gr.update(), gr.update()


def api_discard():
    try:
        canvas_state.discard_pending_result()
        payload = canvas_state.get_tiles_payload()
        payload["type"] = "discard"
        return json.dumps(payload), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())
    except Exception as e:
        import traceback
        traceback.print_exc()
        return "", gr.update(), gr.update()


def api_check_session():
    if canvas_state.is_dirty:
        payload = canvas_state.get_tiles_payload()
        payload["type"] = "session_check"
        payload["has_session"] = True
        payload["preview"] = canvas_state.get_thumbnail_base64()
        return json.dumps(payload)
    else:
        return json.dumps({
            "type": "session_check",
            "has_session": False
        })


def api_restore_session():
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "session_restore"
    payload["thumbnail"] = canvas_state.get_thumbnail_base64(512)
    return json.dumps(payload)


def api_clear_session():
    canvas_state.clear()
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "session_clear"
    return json.dumps(payload)


def reset_canvas():
    from scripts.canvas_state import CanvasState
    import scripts.canvas_state
    scripts.canvas_state.canvas_state = CanvasState()
    return json.dumps(scripts.canvas_state.canvas_state.get_tiles_payload()), gr.update(interactive=False), gr.update(interactive=False)


def toggle_state(state):
    if state == 'prev' and canvas_state.tiles_prev:
        canvas_state.tiles = canvas_state._clone_tiles(canvas_state.tiles_prev)
        canvas_state.current_state = 'prev'
    elif state == 'now' and canvas_state.tiles_now:
        canvas_state.tiles = canvas_state._clone_tiles(canvas_state.tiles_now)
        canvas_state.current_state = 'now'
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "toggle"
    return json.dumps(payload), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())


def handle_upload(image):
    if image is not None:
        canvas_state.load_image(image)
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "upload"
    return json.dumps(payload), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())


def api_save_project(payload_json, p_prompt, p_neg, p_steps, p_cfg, p_shift, p_denoise, p_sampler, p_scheduler, p_w, p_h, p_seed, p_fill, p_outpaint_pad, p_up, p_down, p_name, p_auto_scale):
    import json, zipfile, os, base64, re
    from io import BytesIO
    from PIL import Image
    data = json.loads(payload_json) if payload_json else {}
    viewport = data.get("viewport", {})
    mask_b64 = data.get("mask", "")

    meta = {
        "version": 3,
        "viewport": viewport,
        "prompt": p_prompt,
        "negative_prompt": p_neg,
        "steps": p_steps,
        "cfg_scale": p_cfg,
        "shift": p_shift,
        "denoising_strength": p_denoise,
        "sampler_name": p_sampler,
        "scheduler": p_scheduler,
        "gen_width": p_w,
        "gen_height": p_h,
        "seed": p_seed,
        "inpainting_fill": p_fill,
        "outpaint_pad": p_outpaint_pad,
        "upscaler_name_input": p_up,
        "downscale_algo_input": p_down,
        "auto_scale": p_auto_scale,
        "workflow": canvas_state.workflow,
        "step_params": canvas_state.step_params if canvas_state.step_params else {}
    }

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        import concurrent.futures

        image_sizes = {}
        futures = []
        executor = concurrent.futures.ThreadPoolExecutor()

        def add_tiles_dict(tiles_dict, base_name):
            if tiles_dict:
                for (tx, ty), tile_img in tiles_dict.items():
                    def process_tile(img=tile_img, _tx=tx, _ty=ty):
                        img_io = BytesIO()
                        img.save(img_io, format="WEBP", lossless=True, quality=100, method=4)
                        return (f"{base_name}_t_{_tx * 1024}_{_ty * 1024}.webp", img_io.getvalue())
                    futures.append(executor.submit(process_tile))

        add_tiles_dict(canvas_state.tiles, "canvas")
        add_tiles_dict(canvas_state.tiles_prev, "canvas_prev")
        add_tiles_dict(canvas_state.tiles_now, "canvas_now")

        if mask_b64 and "," in mask_b64:
            try:
                m_img = Image.open(BytesIO(base64.b64decode(mask_b64.split(",")[1])))
                m_io = BytesIO()
                m_img.save(m_io, format="WEBP", lossless=True, quality=100, method=4)
                zip_file.writestr("mask.webp", m_io.getvalue())
            except Exception:
                pass

        meta["canvas_bounds"] = canvas_state.canvas_bounds
        zip_file.writestr("meta.json", json.dumps(meta))

        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                zip_file.writestr(result[0], result[1])

        executor.shutdown(wait=True)

    tmp_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'tmp')
    os.makedirs(tmp_dir, exist_ok=True)
    safe_name = re.sub(r'[^\w\-_\. ]', '_', str(p_name)) if p_name else "project"
    if not safe_name: safe_name = "project"
    file_path = os.path.join(tmp_dir, f"{safe_name}.infcanvas")
    with open(file_path, "wb") as f:
        f.write(zip_buffer.getvalue())

    return gr.update(value=file_path, visible=True)


def api_load_project(*args):
    import zipfile, json, base64
    from io import BytesIO
    from PIL import Image
    file_info = args[0] if args else None
    if file_info is None:
        return [gr.skip()] * 25
    try:
        import os
        filepath = file_info.name if hasattr(file_info, "name") else file_info
        basename = os.path.basename(filepath)
        loaded_name = os.path.splitext(basename)[0]
        meta = {}
        mask_b64 = ""
        with zipfile.ZipFile(filepath, 'r') as zip_ref:
            if "meta.json" in zip_ref.namelist():
                meta = json.loads(zip_ref.read("meta.json").decode('utf-8'))
                
            # Version Fallback parsing
            if meta.get("version", 1) < 3:
                # Migrate old meta to v3 format internally
                meta["version"] = 3
                if "workflow" not in meta:
                    meta["workflow"] = []
                if "step_params" not in meta:
                    meta["step_params"] = {
                        "edge_fix": {"enabled": meta.get("edge_fix", False), "power": meta.get("edge_fix_power", 1.0)},
                        "latent_blend": {"enabled": meta.get("latent_blend", False), "power": meta.get("latent_blend_power", 1.0)}
                    }
            
            canvas_state.update_workflow(meta.get("workflow", []), meta.get("step_params", {}))

            def load_tiles(base_name):
                mode = "RGBA"
                tiles_dict = {}
                tile_names = [n for n in zip_ref.namelist() if n.startswith(f"{base_name}_t_") and n.endswith(".webp")]
                if tile_names:
                    import concurrent.futures
                    def load_single_tile(name):
                        parts = name.replace(".webp", "").split("_")
                        tx, ty = int(parts[-2]) // 1024, int(parts[-1]) // 1024
                        tile_data = zip_ref.read(name)
                        tile_img = Image.open(BytesIO(tile_data))
                        if tile_img.mode != mode:
                            tile_img = tile_img.convert(mode)
                        return (tx, ty), tile_img

                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        futures = [executor.submit(load_single_tile, name) for name in tile_names]
                        for future in concurrent.futures.as_completed(futures):
                            tx, ty = future.result()[0]
                            tile_img = future.result()[1]
                            tiles_dict[(tx, ty)] = tile_img
                    return tiles_dict
                
                # Fallback to single WEBP or PNG file (v1)
                single_img = None
                if f"{base_name}.webp" in zip_ref.namelist():
                    single_img = Image.open(BytesIO(zip_ref.read(f"{base_name}.webp"))).convert(mode)
                elif f"{base_name}.png" in zip_ref.namelist():
                    single_img = Image.open(BytesIO(zip_ref.read(f"{base_name}.png"))).convert(mode)
                
                if single_img:
                    # Manually slice it into 1024x1024 tiles
                    w, h = single_img.size
                    for ty in range(math.ceil(h/1024)):
                        for tx in range(math.ceil(w/1024)):
                            crop = single_img.crop((tx*1024, ty*1024, (tx+1)*1024, (ty+1)*1024))
                            tiles_dict[(tx, ty)] = crop
                    return tiles_dict
                return None

            import math
            canvas_state.tiles = load_tiles("canvas") or {}
            canvas_state.tiles_prev = load_tiles("canvas_prev")
            canvas_state.tiles_now = load_tiles("canvas_now")
            if meta.get("version", 1) < 3:
                # Reconstruct bounds safely from tiles for older projects lacking accurate bounding boxes
                canvas_state._ensure_bounds_cover_tiles()
            else:
                canvas_state.canvas_bounds = meta.get("canvas_bounds", {"x": 0, "y": 0, "w": 1024, "h": 1024})
            
            canvas_state.current_state = 'now'

            # Legacy compatibility: load mask either from mask.webp or stitched mask tiles
            m_img = None
            mask_tiles = load_tiles("mask")
            if mask_tiles:
                max_tx = max([tx for tx, ty in mask_tiles.keys()] + [0])
                max_ty = max([ty for tx, ty in mask_tiles.keys()] + [0])
                w = (max_tx + 1) * 1024
                h = (max_ty + 1) * 1024
                m_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                for (tx, ty), tile_img in mask_tiles.items():
                    m_img.paste(tile_img, (tx * 1024, ty * 1024))
                
            if m_img:
                m_io = BytesIO()
                m_img.save(m_io, format="WEBP", lossless=True, quality=100, method=0)
                mask_b64 = "data:image/webp;base64," + base64.b64encode(m_io.getvalue()).decode('utf-8')

        payload = canvas_state.get_tiles_payload()
        payload["type"] = "project_load"
        payload["viewport"] = meta.get("viewport", {})
        payload["mask"] = mask_b64
        
        print(f"[Infinite Canvas] Project loaded successfully ({len(canvas_state.tiles)} tiles, mask: {len(mask_b64)} bytes)")

        return [
            json.dumps(payload),
            gr.update(interactive=canvas_state.can_undo()),
            gr.update(interactive=canvas_state.can_redo()),
            meta.get("prompt", gr.skip()),
            meta.get("negative_prompt", gr.skip()),
            meta.get("steps", gr.skip()),
            meta.get("cfg_scale", gr.skip()),
            meta.get("shift", gr.skip()),
            meta.get("denoising_strength", gr.skip()),
            meta.get("sampler_name", gr.skip()),
            meta.get("scheduler", gr.skip()),
            meta.get("gen_width", gr.skip()),
            meta.get("gen_height", gr.skip()),
            meta.get("seed", gr.skip()),
            meta.get("inpainting_fill", 1),
            meta.get("outpaint_pad", "Black"),
            meta.get("upscaler_name_input", gr.skip()),
            meta.get("downscale_algo_input", gr.skip()),
            meta.get("auto_scale", gr.skip()),
            gr.update(value=None),
            gr.update(value=loaded_name)
        ]
    except Exception as e:
        print(f"Error loading project: {e}")
        return [json.dumps({"type": "error", "message": f"Failed to load project: {e}"})] + [gr.skip()]*18 + [gr.update(value=None), gr.skip()]


def api_sam_predict(payload_json):
    if not payload_json: return ""
    try:
        data = json.loads(payload_json)
        points = data.get("points") # list of [x, y]
        image_b64 = data.get("image")
        if not points or not image_b64: return ""

        import numpy as np

        image_data = base64.b64decode(image_b64.split(",")[1])
        image = Image.open(BytesIO(image_data)).convert("RGB")
        image_np = np.array(image)

        global sam2_model
        if sam2_model is None:
            from ultralytics import SAM
            sam_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'models', 'sam')
            os.makedirs(sam_dir, exist_ok=True)
            sam_model_path = os.path.join(sam_dir, 'sam2.1_t.pt')

            if not os.path.exists(sam_model_path):
                print(f"[Infinite Canvas] SAM 2.1 model not found at {sam_model_path}. Downloading...")
                try:
                    import urllib.request
                    url = "https://github.com/ultralytics/assets/releases/download/v8.3.0/sam2.1_t.pt"
                    urllib.request.urlretrieve(url, sam_model_path)
                    print("[Infinite Canvas] SAM 2.1 model downloaded successfully.")
                except Exception as e:
                    print(f"[Infinite Canvas] Error downloading SAM 2.1 model: {e}")
                    return json.dumps({"type": "error", "message": "Failed to download SAM model. Please check the console."})

            try:
                sam2_model = SAM(sam_model_path)
            except Exception as e:
                print(f"[Infinite Canvas] Error loading SAM 2.1 model: {e}")
                return json.dumps({"type": "error", "message": "Failed to load SAM model. Please check the console."})

        # ultralytics SAM inference
        print(f"[Infinite Canvas] SAM Predict - Image shape: {image_np.shape}, Points: {points}")
        results = sam2_model(image_np, points=points, labels=[1]*len(points), verbose=False)

        if results and len(results) > 0 and getattr(results[0], 'masks', None) is not None:
            if len(results[0].masks.data) > 0:
                mask_data = (results[0].masks.data[0].cpu().numpy() * 255).astype(np.uint8)

                dilation = int(data.get("dilation", 0))
                if dilation > 0:
                    import cv2
                    # Limit dilation size for performance, maybe up to 100
                    k_size = min(dilation, 100) * 2 + 1
                    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k_size, k_size))
                    mask_data = cv2.dilate(mask_data, kernel, iterations=1)

                # Create RGBA image: White where masked, transparent otherwise
                color_data = np.zeros((*mask_data.shape, 4), dtype=np.uint8)
                color_data[:, :, 0:3] = 255  # White RGB
                color_data[:, :, 3] = mask_data  # Alpha from mask
                mask_img = Image.fromarray(color_data, 'RGBA')

                buffered = BytesIO()
                mask_img.save(buffered, format="PNG")
                mask_b64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

                return json.dumps({
                    "type": "sam_result",
                    "mask": mask_b64
                })
            else:
                print("[Infinite Canvas] SAM found no object at the given point.")
                return json.dumps({"type": "error", "message": "No object found at the clicked point."})
    except Exception as e:
        print(f"[Infinite Canvas] SAM Predict Error: {e}")
        import traceback
        traceback.print_exc()
        return json.dumps({"type": "error", "message": str(e)})
    return ""



def api_get_workflow():
    import json
    
    pipeline_template = [
        PrepareCanvasStep,
        LLMPromptOptimizeStep,
        AppendCloseUpStep,
        SetupProcessingStep,
        LatentBlendStep,
        FirstPassStep,
        EdgeFixStep,
        FinalizeStateStep
    ]
    
    registry = []
    for cls in pipeline_template:
        registry.append({
            "id": cls.id,
            "name": getattr(cls, 'name', cls.__name__),
            "is_plugin": getattr(cls, 'is_plugin', False),
            "sort_index": getattr(cls, 'sort_index', 500),
            "params": cls.get_params()
        })
        
    return json.dumps({
        "type": "workflow_query",
        "workflow": canvas_state.workflow,
        "step_params": canvas_state.step_params,
        "registry": registry
    })

def api_update_workflow(payload_json):
    import json
    if payload_json:
        try:
            data = json.loads(payload_json)
            payload_step_params = data.get("step_params", {})
            plugins = [cls for cls in GenerationStep.__subclasses__() if getattr(cls, 'is_plugin', False)]
            
            for plugin_cls in plugins:
                if plugin_cls.id in payload_step_params:
                    resolved = plugin_cls.resolve_params(payload_step_params[plugin_cls.id])
                    if plugin_cls.id not in canvas_state.step_params:
                        canvas_state.step_params[plugin_cls.id] = {}
                    canvas_state.step_params[plugin_cls.id].update(resolved)
                    
        except Exception as e:
            print(f"[Infinite Canvas] Error updating workflow: {e}")
            
    return api_get_workflow()
