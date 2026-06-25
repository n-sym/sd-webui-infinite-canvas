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
from scripts.pipeline_types import GenerationCtx, GenerationStep, SamplerConfigData, ResolutionData, CanvasConfigData
from scripts.typing_system import *
from scripts.plugins.llm_prompt_optimize import LLMPromptOptimizeStep
from scripts.plugins.append_close_up import AppendCloseUpStep
from scripts.plugins.prompt_review import PromptReviewStep
from scripts.plugins.latent_blend import LatentBlendStep
from scripts.plugins.second_pass import SecondPassStep
from scripts.plugins.edge_fix import EdgeFixStep
from scripts.plugins.cross_attn_injector import CrossAttnInjectorStep
import scripts.plugins.prompt_review as prompt_review
import uuid

pending_sessions = {}

def pause_generation_and_show_dynamic_dialog(ctx: GenerationCtx, title: str, html_content: str, js_code: str):
    session_id = str(uuid.uuid4())
    pending_sessions[session_id] = ctx
    payload = {
        "type": "dynamic_dialog",
        "session_id": session_id,
        "title": title,
        "html": html_content,
        "js": js_code
    }
    ctx.set(FinalPayload, json.dumps(payload))
    return ctx

class ParseInputStep(GenerationStep):
    id = "parse_input"
    name = "SD-Style Input"
    sort_index = 0

    @classmethod
    def type_signature(cls):
        return {"in": [SdStyleInput], "out": [Prompt, SamplerConfig, Resolution, InputImage, InputMask]}

    @classmethod
    def get_params(cls):
        from modules import shared, sd_samplers, sd_schedulers
        samplers = [x.name for x in sd_samplers.all_samplers]
        schedulers = ["Automatic"] + [x.label for x in sd_schedulers.schedulers]
        upscalers = [x.name for x in shared.sd_upscalers]
        return [
            {"name": "prompt", "type": "text", "label": "Prompt", "default": ""},
            {"name": "negative_prompt", "type": "text", "label": "Negative Prompt", "default": ""},
            {"name": "steps", "type": "int", "label": "Steps", "default": 20, "min": 1, "max": 100, "step": 1},
            {"name": "cfg_scale", "type": "float", "label": "CFG Scale", "default": 4.0, "min": 1.0, "max": 30.0, "step": 0.1},
            {"name": "shift", "type": "float", "label": "Shift", "default": 1.0, "min": 0.0, "max": 30.0, "step": 0.1},
            {"name": "denoising_strength", "type": "float", "label": "Denoising Strength", "default": 0.6, "min": 0.0, "max": 1.0, "step": 0.05},
            {"name": "sampler_name", "type": "enum", "label": "Sampler", "choices": samplers, "default": "Euler"},
            {"name": "scheduler", "type": "enum", "label": "Scheduler", "choices": schedulers, "default": "Beta"},
            {"name": "gen_width", "type": "int", "label": "Width", "default": 1024, "min": 256, "max": 2048, "step": 16},
            {"name": "gen_height", "type": "int", "label": "Height", "default": 1024, "min": 256, "max": 2048, "step": 16},
            {"name": "seed", "type": "randomseed", "label": "Seed", "default": -1, "min": -1, "max": 4294967295, "step": 1},
            {"name": "outpaint_pad", "type": "enum", "label": "Outpaint Pad", "choices": ["Black", "White", "Extend Edge", "Edge Blur"], "default": "Black"},
            {"name": "inpainting_fill", "type": "enum", "label": "Inpainting Fill", "choices": ["fill", "original", "latent noise", "latent nothing"], "default": "original"},
            {"name": "upscaler_name", "type": "enum", "label": "Upscaler", "choices": upscalers, "default": "None"},
            {"name": "auto_scale", "type": "bool", "label": "Auto Scale Canvas", "default": True},
            {"name": "downscale_algo", "type": "enum", "label": "Downscale Algo", "choices": ["Bicubic", "Lanczos", "Bilinear", "Nearest"], "default": "Bicubic"},
            {"name": "compile_preset", "type": "enum", "label": "Torch Compile Preset", "choices": ["Disable", "guard_filter_fn", "dynamic", "max-autotune", "max-autotune-no-cudagraphs", "reduce-overhead"], "default": "Disable"},
        ]

    @classmethod
    def resolve_params(cls, raw_params):
        def _get(k, default):
            v = raw_params.get(k)
            return default if v is None else v
        
        # Handle legacy inpainting_fill_idx from older projects
        legacy_fill = raw_params.get("inpainting_fill_idx")
        fill_val = _get("inpainting_fill", legacy_fill if legacy_fill is not None else "original")
        choices = ["fill", "original", "latent noise", "latent nothing"]
        if isinstance(fill_val, int):
            fill_val = choices[fill_val] if 0 <= fill_val < len(choices) else "original"
        elif fill_val not in choices:
            fill_val = "original"
        
        return {
            "prompt": str(_get("prompt", "")),
            "negative_prompt": str(_get("negative_prompt", "")),
            "steps": int(_get("steps", 20)),
            "cfg_scale": float(_get("cfg_scale", 4.0)),
            "shift": float(_get("shift", 1.0)),
            "denoising_strength": float(_get("denoising_strength", 0.6)),
            "sampler_name": str(_get("sampler_name", "Euler")),
            "scheduler": str(_get("scheduler", "Beta")),
            "gen_width": int(_get("gen_width", 1024)),
            "gen_height": int(_get("gen_height", 1024)),
            "seed": int(_get("seed", -1)),
            "outpaint_pad": str(_get("outpaint_pad", "Black")),
            "inpainting_fill": fill_val,
            "upscaler_name": str(_get("upscaler_name", "None")),
            "auto_scale": bool(_get("auto_scale", True)),
            "downscale_algo": str(_get("downscale_algo", "Bicubic")),
            "compile_preset": str(_get("compile_preset", "Disable")),
        }

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

        # Resolve parse_input's own params (the generation scalars) and write
        # them as TypedRecords onto the GenerationCtx.
        payload_step_params = data.get("step_params", {})
        resolved = ParseInputStep.resolve_params(payload_step_params.get('parse_input', {}))
        ctx.step_params['parse_input'] = resolved
        ctx.var = resolved
        
        ctx.set(Prompt, resolved['prompt'])
        ctx.set(NegativePrompt, resolved['negative_prompt'])
        ctx.set(SamplerConfig, SamplerConfigData(
            steps=resolved['steps'],
            cfg_scale=resolved['cfg_scale'],
            shift=resolved['shift'],
            denoising_strength=resolved['denoising_strength'],
            sampler_name=resolved['sampler_name'],
            scheduler=resolved['scheduler'],
            seed=resolved['seed']
        ))
        ctx.set(Resolution, ResolutionData(
            gen_width=resolved['gen_width'],
            gen_height=resolved['gen_height'],
            generation_res=max(resolved['gen_width'], resolved['gen_height'])
        ))
        ctx.set(CanvasConfig, CanvasConfigData(
            outpaint_pad=resolved['outpaint_pad'],
            inpainting_fill=resolved['inpainting_fill'],
            upscaler_name=resolved['upscaler_name'],
            auto_scale=resolved['auto_scale'],
            downscale_algo=resolved['downscale_algo'],
            compile_preset=resolved['compile_preset']
        ))
        
        ctx.set(SourceRect, data.get('source_rect', {}))
        ctx.set(TargetRect, data.get('target_rect', {}))
        ctx.set(MaskBase64, data.get('mask_base64', ''))

        ctx.workflow = data.get("workflow", [])

        plugins = [cls for cls in GenerationStep.__subclasses__() if getattr(cls, 'is_plugin', False)]

        for plugin_cls in plugins:
            if plugin_cls.id in payload_step_params:
                plugin_resolved = plugin_cls.resolve_params(payload_step_params[plugin_cls.id])
                if plugin_cls.id not in ctx.step_params:
                    ctx.step_params[plugin_cls.id] = {}
                ctx.step_params[plugin_cls.id].update(plugin_resolved)

        canvas_state.update_workflow(ctx.workflow, ctx.step_params)

        return ctx


class PrepareCanvasStep(GenerationStep):
    id = "prepare_canvas"
    name = "Prepare Canvas"
    sort_index = 10

    @classmethod
    def type_signature(cls):
        return {"in": [InputImage, InputMask, Resolution], "out": [InputImage, InputMask]}

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        cc = ctx.get(CanvasConfig)
        res = ctx.get(Resolution)
        
        prep_info = canvas_state.prepare_generation(
            ctx.get(SourceRect), ctx.get(TargetRect), 
            generation_res=res.generation_res, 
            upscaler_name=cc.upscaler_name, 
            mask_base64=ctx.get(MaskBase64), 
            auto_scale=cc.auto_scale, 
            outpaint_pad=cc.outpaint_pad
        )
        if not prep_info:
            ctx.set(FinalPayload, json.dumps(canvas_state.get_tiles_payload()))
            ctx.set(SoftStop, True) # Stop pipeline without throwing an error
            return ctx
            
        ctx.set(PreparedCanvas, prep_info)
        ctx.set(InputImage, prep_info['image'])
        ctx.set(InputMask, prep_info['mask'])
        ctx.set(PasteMask, prep_info.get('paste_mask', prep_info['mask']))
        ctx.set(CanvasSourceRect, prep_info['canvas_source_rect'])
        
        if prep_info.get('is_empty_canvas', False):
            print("[Infinite Canvas] Blank canvas detected. Will use txt2img processing.")
            
        return ctx





class SetupProcessingStep(GenerationStep):
    id = "setup_processing"
    name = "Setup SD"
    sort_index = 20

    @classmethod
    def type_signature(cls):
        return {"in": [Prompt, SamplerConfig, Resolution, InputImage, InputMask], "out": [SdProcessing]}

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        prep = ctx.get(PreparedCanvas)
        prompt = ctx.get(Prompt)
        neg = ctx.get(NegativePrompt)
        sc = ctx.get(SamplerConfig)
        res = ctx.get(Resolution)
        init_img = ctx.get(InputImage)
        mask = ctx.get(InputMask)
        cc = ctx.get(CanvasConfig)
        
        if prep.get('is_empty_canvas', False):
            p = processing.StableDiffusionProcessingTxt2Img(
                sd_model=shared.sd_model,
                outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_txt2img_samples,
                outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_txt2img_grids,
                prompt=prompt,
                negative_prompt=neg,
                styles=[],
                seed=sc.seed,
                subseed=-1,
                subseed_strength=0,
                seed_resize_from_h=0,
                seed_resize_from_w=0,
                seed_enable_extras=False,
                sampler_name=sc.sampler_name,
                scheduler=sc.scheduler,
                batch_size=1,
                n_iter=1,
                steps=sc.steps,
                cfg_scale=sc.cfg_scale,
                distilled_cfg_scale=sc.shift,
                width=res.gen_width,
                height=res.gen_height,
                restore_faces=False,
                tiling=False,
            )
        else:
            p = processing.StableDiffusionProcessingImg2Img(
                sd_model=shared.sd_model,
                outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_img2img_samples,
                outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_img2img_grids,
                prompt=prompt,
                negative_prompt=neg,
                styles=[],
                seed=sc.seed,
                subseed=-1,
                subseed_strength=0,
                seed_resize_from_h=0,
                seed_resize_from_w=0,
                seed_enable_extras=False,
                sampler_name=sc.sampler_name,
                scheduler=sc.scheduler,
                batch_size=1,
                n_iter=1,
                steps=sc.steps,
                cfg_scale=sc.cfg_scale,
                distilled_cfg_scale=sc.shift,
                width=res.gen_width,
                height=res.gen_height,
                restore_faces=False,
                tiling=False,
                init_images=[init_img],
                mask=mask,
                mask_blur=4,
                inpainting_fill=["fill", "original", "latent noise", "latent nothing"].index(cc.inpainting_fill) if cc.inpainting_fill in ["fill", "original", "latent noise", "latent nothing"] else 1,
                resize_mode=0,
                denoising_strength=sc.denoising_strength,
                image_cfg_scale=None,
                inpaint_full_res=False,
                inpaint_full_res_padding=0,
                inpainting_mask_invert=0,
            )
        p.script_args = (float(ctx.step_params.get("latent_blend", {}).get("power", 1.0)), )
        p.extra_generation_params["IC Upscaler"] = cc.upscaler_name
        p.extra_generation_params["IC Auto Scale"] = cc.auto_scale
        ctx.set(SdProcessing, p)
        
        # Prepare edge masks
        edge_fix_params = ctx.step_params.get("edge_fix", {})
        latent_blend_params = ctx.step_params.get("latent_blend", {})
        if edge_fix_params.get("enabled", False) or latent_blend_params.get("enabled", False):
            ctx.set(MaskGenSizeArr, cv2.resize(np.array(mask), (res.gen_width, res.gen_height), interpolation=cv2.INTER_NEAREST))
            
        return ctx

def ic_process_images(p, ctx):
    cc = ctx.get(CanvasConfig)
    compile_preset = cc.compile_preset if cc else "Disable"
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
    name = "Generation"
    sort_index = 100

    @classmethod
    def type_signature(cls):
        return {"in": [SdProcessing], "out": [GeneratedImage, Error]}

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        p = ctx.get(SdProcessing)
        processed = ic_process_images(p, ctx)

        # Capture the seed Forge actually sampled (when the user passed -1,
        # Forge generates one). Exposed via the payload so the frontend's
        # "reuse seed" button can replay it.
        try:
            ctx.set(UsedSeed, int(processed.seed))
        except Exception:
            pass

        if processed.images:
            ctx.set(GeneratedImage, processed.images[0])
        else:
            ctx.set(Error, "No images returned from first pass.")

        return ctx





class FinalizeStateStep(GenerationStep):
    id = "finalize_state"
    name = "Get Final Image"
    sort_index = 1000

    @classmethod
    def type_signature(cls):
        return {"in": [GeneratedImage], "out": [FinalOutputImage]}

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        result_img = ctx.get(GeneratedImage)
        if not result_img:
            return ctx
            
        blured = ctx.get(BluredEdgeMaskArr)
        edge_fix_mask_img = Image.fromarray(blured) if blured is not None else None
        
        cc = ctx.get(CanvasConfig)
        csr = ctx.get(CanvasSourceRect)
        paste_mask = ctx.get(PasteMask)
        prep = ctx.get(PreparedCanvas)
        
        canvas_state.set_pending_result(result_img, prep['canvas_source_rect'], paste_mask, cc.downscale_algo, edge_fix_mask=edge_fix_mask_img)
        
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
            "scale": prep['transform']['scale'],
            "pad_left": prep['transform']['pad_left'],
            "pad_top": prep['transform']['pad_top'],
            "rect_x": prep['canvas_source_rect']['x'],
            "rect_y": prep['canvas_source_rect']['y']
        }
        if edge_mask_b64:
            payload["edge_mask"] = edge_mask_b64

        # Surface the seed Forge actually used so the frontend can offer a
        # "reuse seed" action (re-applies this value to the seed input).
        used_seed = ctx.get(UsedSeed)
        if used_seed is not None:
            payload["used_seed"] = used_seed

        ctx.set(FinalPayload, json.dumps(payload))
        return ctx




def api_apply(feather_radius):
    try:
        feather = float(feather_radius)
        canvas_state.apply_pending_result(feather)
        payload = canvas_state.get_tiles_payload()
        payload["type"] = "apply"
        payload["can_undo"] = canvas_state.can_undo()
        payload["can_redo"] = canvas_state.can_redo()
        return payload
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


def api_discard():
    try:
        canvas_state.discard_pending_result()
        payload = canvas_state.get_tiles_payload()
        payload["type"] = "discard"
        payload["can_undo"] = canvas_state.can_undo()
        payload["can_redo"] = canvas_state.can_redo()
        return payload
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


def reset_canvas():
    canvas_state.clear()
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "session_clear"
    payload["can_undo"] = False
    payload["can_redo"] = False
    return payload


def toggle_state(state):
    if state == 'prev' and canvas_state.tiles_prev:
        canvas_state.tiles = canvas_state._clone_tiles(canvas_state.tiles_prev)
        canvas_state.current_state = 'prev'
    elif state == 'now' and canvas_state.tiles_now:
        canvas_state.tiles = canvas_state._clone_tiles(canvas_state.tiles_now)
        canvas_state.current_state = 'now'
    
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "toggle"
    payload["can_undo"] = canvas_state.can_undo()
    payload["can_redo"] = canvas_state.can_redo()
    return payload


def handle_upload(img):
    if img is None:
        return {"error": "No image uploaded"}
        
    reset_canvas()
    
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
        
    canvas_state.load_image(img)
    canvas_state.is_dirty = True
    
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "upload"
    payload["can_undo"] = canvas_state.can_undo()
    payload["can_redo"] = canvas_state.can_redo()
    return payload

def api_list_projects():
    if not os.path.exists(canvas_state.projects_dir):
        return []
    
    infcanvas_names = set()
    png_names = set()
    
    for f in os.listdir(canvas_state.projects_dir):
        if f.endswith(".infcanvas"):
            infcanvas_names.add(f[:-10])
        elif f.lower().endswith(".png"):
            png_names.add(f[:-4])
            
    all_projects = infcanvas_names.union(png_names)
    return sorted(list(all_projects))

def api_list_projects_json():
    import json, os
    if not os.path.exists(canvas_state.projects_dir):
        return json.dumps([])
    
    projects = []
    infcanvas_names = set()
    
    for f in os.listdir(canvas_state.projects_dir):
        if f.endswith(".infcanvas"):
            p_name = f[:-10]
            infcanvas_names.add(p_name)
            p_path = os.path.join(canvas_state.projects_dir, f)
            p_time = os.path.getmtime(p_path)
            projects.append({"name": p_name, "mtime": p_time})
            
    for f in os.listdir(canvas_state.projects_dir):
        if f.lower().endswith(".png"):
            p_name = f[:-4]
            if p_name not in infcanvas_names:
                p_path = os.path.join(canvas_state.projects_dir, f)
                p_time = os.path.getmtime(p_path)
                projects.append({"name": p_name, "mtime": p_time})
                
    projects.sort(key=lambda x: x["mtime"], reverse=True)
    return json.dumps(projects)

def api_save_project(payload_json, p_prompt, p_neg, p_steps, p_cfg, p_shift, p_denoise, p_sampler, p_scheduler, p_w, p_h, p_seed, p_fill, p_outpaint_pad, p_up, p_down, p_name, p_auto_scale):
    import json
    import os, zipfile, base64, re
    from io import BytesIO
    from PIL import Image
    data = json.loads(payload_json) if payload_json else {}
    viewport = data.get("viewport", {})
    mask_b64 = data.get("mask", "")

    # Tell the frontend we've started saving so it can open the toast.
    safe_name_preview = re.sub(r'[^\w\-_\. ]', '_', str(p_name)) if p_name else "project"
    try:
        from scripts.ic_server.api_routes import manager
        manager.broadcast_from_thread({"type": "save", "status": "saving", "name": safe_name_preview})
    except Exception as e:
        print(f"[Infinite Canvas] Failed to broadcast save-start: {e}")

    meta = {
        "version": 3,
        "viewport": viewport,
        "workflow": canvas_state.workflow,
        "step_params": canvas_state.step_params if canvas_state.step_params else {}
    }

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        import concurrent.futures

        image_sizes = {}
        futures = []
        executor = concurrent.futures.ThreadPoolExecutor()

        def add_tiles_dict(tiles_snapshot, base_name):
            if tiles_snapshot:
                for (tx, ty), tile_img in tiles_snapshot:
                    def process_tile(img=tile_img, _tx=tx, _ty=ty):
                        from scripts.canvas_state import get_tile_uid
                        uid = get_tile_uid(img)
                        with canvas_state._cache_lock:
                            if uid in canvas_state.tile_webp_cache:
                                return (f"{base_name}_t_{_tx * 1024}_{_ty * 1024}.webp", canvas_state.tile_webp_cache[uid])
                        img_io = BytesIO()
                        img.save(img_io, format="WEBP", lossless=True, quality=100, method=4)
                        return (f"{base_name}_t_{_tx * 1024}_{_ty * 1024}.webp", img_io.getvalue())
                    futures.append(executor.submit(process_tile))

        with canvas_state.state_lock:
            tiles_snap = list(canvas_state.tiles.items()) if canvas_state.tiles else []
            tiles_prev_snap = list(canvas_state.tiles_prev.items()) if canvas_state.tiles_prev else []
            tiles_now_snap = list(canvas_state.tiles_now.items()) if canvas_state.tiles_now else []
            meta["canvas_bounds"] = canvas_state.canvas_bounds.copy()

        add_tiles_dict(tiles_snap, "canvas")
        add_tiles_dict(tiles_prev_snap, "canvas_prev")
        add_tiles_dict(tiles_now_snap, "canvas_now")

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

    safe_name = re.sub(r'[^\w\-_\. ]', '_', str(p_name)) if p_name else "project"
    if not safe_name: safe_name = "project"

    canvas_state.current_project_name = safe_name

    os.makedirs(canvas_state.projects_dir, exist_ok=True)
    file_path = os.path.join(canvas_state.projects_dir, f"{safe_name}.infcanvas")
    with open(file_path, "wb") as f:
        f.write(zip_buffer.getvalue())

    # Signal completion so the frontend closes the "saving" toast.
    try:
        from scripts.ic_server.api_routes import manager
        manager.broadcast_from_thread({"type": "save", "status": "done", "name": safe_name})
    except Exception as e:
        print(f"[Infinite Canvas] Failed to broadcast save-done: {e}")

    return gr.update(choices=api_list_projects(), value=safe_name)

def _load_zip_into_canvas_state(filepath):
    import zipfile, json, base64
    from io import BytesIO
    from PIL import Image
    import os
    
    meta = {}
    mask_b64 = ""
    with zipfile.ZipFile(filepath, 'r') as zip_ref:
        if "meta.json" in zip_ref.namelist():
            meta = json.loads(zip_ref.read("meta.json").decode('utf-8'))
            
        # Version Fallback parsing
        if meta.get("version", 1) == 1:
            meta["version"] = 2
            meta["workflow"] = []
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
                raw_tiles = []
                for name in tile_names:
                    parts = name.replace(".webp", "").split("_")
                    tx, ty = int(parts[-2]) // 1024, int(parts[-1]) // 1024
                    raw_tiles.append((tx, ty, zip_ref.read(name)))

                def decode_tile(tx, ty, tile_data):
                    tile_img = Image.open(BytesIO(tile_data))
                    if tile_img.mode != mode:
                        tile_img = tile_img.convert(mode)

                    from scripts.canvas_state import get_tile_uid
                    uid = get_tile_uid(tile_img)
                    with canvas_state._cache_lock:
                        canvas_state.tile_webp_cache[uid] = tile_data
                    
                    return (tx, ty), tile_img

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    futures = [executor.submit(decode_tile, tx, ty, data) for tx, ty, data in raw_tiles]
                    for future in concurrent.futures.as_completed(futures):
                        (tx, ty), tile_img = future.result()
                        tiles_dict[(tx, ty)] = tile_img
                return tiles_dict
            
            # Fallback to single WEBP or PNG file (v1)
            single_img = None
            if f"{base_name}.webp" in zip_ref.namelist():
                single_img = Image.open(BytesIO(zip_ref.read(f"{base_name}.webp"))).convert(mode)
            elif f"{base_name}.png" in zip_ref.namelist():
                single_img = Image.open(BytesIO(zip_ref.read(f"{base_name}.png"))).convert(mode)
            
            if single_img:
                import math
                w, h = single_img.size
                for ty in range(math.ceil(h/1024)):
                    for tx in range(math.ceil(w/1024)):
                        crop = single_img.crop((tx*1024, ty*1024, (tx+1)*1024, (ty+1)*1024))
                        tiles_dict[(tx, ty)] = crop
                return tiles_dict
            return None

        canvas_state.tiles = load_tiles("canvas") or {}
        canvas_state.tiles_prev = load_tiles("canvas_prev")
        canvas_state.tiles_now = load_tiles("canvas_now")
        canvas_state.canvas_bounds = meta.get("canvas_bounds", {"x": 0, "y": 0, "w": 1024, "h": 1024})

        # Legacy compatibility: load mask either from mask.webp or stitched mask tiles
        m_img = None
        if "mask.webp" in zip_ref.namelist():
            m_img = Image.open(BytesIO(zip_ref.read("mask.webp"))).convert("RGBA")
        elif "mask.png" in zip_ref.namelist():
            m_img = Image.open(BytesIO(zip_ref.read("mask.png"))).convert("RGBA")
        else:
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

    return meta, mask_b64

def _load_png_into_canvas_state(filepath):
    import json
    from PIL import Image
    import math
    from modules import images
    from modules.infotext_utils import parse_generation_parameters
    
    meta = {}
    mask_b64 = ""
    
    img = Image.open(filepath)
    geninfo, items = images.read_info_from_image(img)
    if geninfo:
        params = parse_generation_parameters(geninfo)
        
        meta["prompt"] = params.get("Prompt", "")
        meta["negative_prompt"] = params.get("Negative prompt", "")
        if "Steps" in params: meta["steps"] = params["Steps"]
        if "CFG scale" in params: meta["cfg_scale"] = params["CFG scale"]
        if "Sampler" in params: meta["sampler_name"] = params["Sampler"]
        if "Seed" in params: meta["seed"] = params["Seed"]
        if "Denoising strength" in params: meta["denoising_strength"] = params["Denoising strength"]
        
    w, h = img.size
    meta["gen_width"] = w
    meta["gen_height"] = h

    meta["version"] = 2
    meta["workflow"] = []
    meta["step_params"] = {
        "edge_fix": {"enabled": False, "power": 1.0},
        "latent_blend": {"enabled": False, "power": 1.0}
    }
    
    canvas_state.update_workflow(meta.get("workflow", []), meta.get("step_params", {}))

    mode = "RGBA"
    if img.mode != mode:
        img = img.convert(mode)
    
    tiles_dict = {}
    for ty in range(math.ceil(h/1024)):
        for tx in range(math.ceil(w/1024)):
            crop = img.crop((tx*1024, ty*1024, (tx+1)*1024, (ty+1)*1024))
            tiles_dict[(tx, ty)] = crop

    canvas_state.tiles = tiles_dict
    canvas_state.tiles_prev = None
    canvas_state.tiles_now = None
    canvas_state.canvas_bounds = {"x": 0, "y": 0, "w": w, "h": h}
    
    return meta, mask_b64


def api_load_project(p_name, recover_autosave=False, *args):
    print(f"[DEBUG] api_load_project called with p_name: '{p_name}', recover_autosave: {recover_autosave}")
    if not p_name:
        print("[DEBUG] p_name is empty, returning skips")
        return [gr.skip()] * 20
        
    try:
        import os, json, re
        safe_name = re.sub(r'[^\w\-_\\. ]', '_', str(p_name))
        base_name = safe_name[:-4] if safe_name.lower().endswith(".png") else safe_name
        
        is_png = False
        infcanvas_filepath = os.path.join(canvas_state.projects_dir, f"{base_name}.infcanvas")
        png_filepath = os.path.join(canvas_state.projects_dir, f"{base_name}.png")
        
        if os.path.exists(infcanvas_filepath):
            filepath = infcanvas_filepath
        elif os.path.exists(png_filepath):
            filepath = png_filepath
            is_png = True
        else:
            filepath = infcanvas_filepath

        proj_filepath = filepath
        autosave_filepath = os.path.join(canvas_state.autosaves_dir, f"{base_name}.infcanvas")
        
        if recover_autosave and not is_png:
            if os.path.exists(autosave_filepath):
                filepath = autosave_filepath
                print(f"[DEBUG] Recovering autosave from: {filepath}")
        
        print(f"[DEBUG] Loading from filepath: {filepath}")
        if not os.path.exists(filepath):
            print("[DEBUG] Filepath does not exist!")
            return [gr.skip()] * 20
            
        loaded_name = base_name
        canvas_state.current_project_name = loaded_name
        if is_png:
            meta, mask_b64 = _load_png_into_canvas_state(filepath)
            print("[DEBUG] Successfully loaded png into canvas state")
        else:
            meta, mask_b64 = _load_zip_into_canvas_state(filepath)
            print("[DEBUG] Successfully loaded zip into canvas state")
        

        import time
        payload = canvas_state.get_tiles_payload(skip_autosave=True)
        payload["type"] = "project_load"
        payload["viewport"] = meta.get("viewport", {})
        payload["mask"] = mask_b64
        payload["ts"] = time.time()
        payload["loaded_name"] = loaded_name

        # The frontend now reads generation params from canvas_state.step_params
        # via /workflow (the project_load handler re-fetches /workflow, which
        # re-renders ParseInputStep's card). So make sure step_params['parse_input']
        # is populated here — either from the saved step_params, or rebuilt from
        # the legacy flat meta keys for old (pre-refactor) project files.
        meta_step_params = meta.get("step_params", {})
        if isinstance(meta_step_params, dict) and meta_step_params.get('parse_input'):
            # New-format project: parse_input already saved alongside plugin params.
            pass  # canvas_state.step_params was already restored by _load_zip_into_canvas_state.
        else:
            # Legacy project (or step_params.parse_input missing): rebuild
            # parse_input from the flat meta keys. Map the old key names that
            # differ from ParseInputStep's param names.
            legacy = {
                "prompt": meta.get("prompt", ""),
                "negative_prompt": meta.get("negative_prompt", ""),
                "steps": meta.get("steps", 20),
                "cfg_scale": meta.get("cfg_scale", 4.0),
                "shift": meta.get("shift", 1.0),
                "denoising_strength": meta.get("denoising_strength", 0.6),
                "sampler_name": meta.get("sampler_name", "Euler"),
                "scheduler": meta.get("scheduler", "Beta"),
                "gen_width": meta.get("gen_width", 1024),
                "gen_height": meta.get("gen_height", 1024),
                "seed": meta.get("seed", -1),
                "inpainting_fill": meta.get("inpainting_fill", "original"),
                "outpaint_pad": meta.get("outpaint_pad", "Black"),
                "upscaler_name": meta.get("upscaler_name_input", "None"),
                "auto_scale": meta.get("auto_scale", True),
                "downscale_algo": meta.get("downscale_algo_input", "Bicubic"),
                "compile_preset": meta.get("compile_preset", "Disable"),
            }
            if 'parse_input' not in canvas_state.step_params:
                canvas_state.step_params['parse_input'] = {}
            canvas_state.step_params['parse_input'].update(ParseInputStep.resolve_params(legacy))

        print(f"[Infinite Canvas] Project loaded successfully ({len(canvas_state.tiles)} tiles, mask: {len(mask_b64)} bytes)")
        return payload
    except Exception as e:
        import traceback
        print(f"Error loading project: {e}")
        traceback.print_exc()
        return {"error": f"Failed to load project: {e}"}


def api_import_project(filepath):
    import os, shutil, re
    if not filepath or not os.path.exists(filepath):
        return {"error": "Invalid file path"}
        
    try:
        basename = os.path.basename(filepath)
        name, ext = os.path.splitext(basename)
        safe_name = re.sub(r'[^\w\-_\\. ]', '_', name)
        
        if ext.lower() == ".png":
            new_filepath = os.path.join(canvas_state.projects_dir, f"{safe_name}.png")
            safe_name_to_load = safe_name
        else:
            new_filepath = os.path.join(canvas_state.projects_dir, f"{safe_name}.infcanvas")
            safe_name_to_load = safe_name
            
        shutil.copy2(filepath, new_filepath)
        
        return api_load_project(safe_name_to_load)
    except Exception as e:
        import traceback
        print(f"Error importing project: {e}")
        traceback.print_exc()
        return {"error": f"Failed to import project: {e}"}


def api_set_autosave(enabled):
    canvas_state.autosave_enabled = bool(enabled)
    return {"status": "success"}

def api_download_canvas():
    from io import BytesIO
    canvas_state._ensure_bounds_cover_tiles()
    bounds = canvas_state.canvas_bounds
    if bounds['w'] <= 0 or bounds['h'] <= 0:
        return None
    img = canvas_state._extract_from_tiles_for_rect(bounds)
    
    # Auto-crop transparent padding
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()

def api_check_autosave():
    status = getattr(canvas_state, "autosave_status", "idle")
    if status == "done":
        canvas_state.autosave_status = "idle"
    return {"status": status}

def api_check_project_autosave(p_name):
    import os, time, re
    ts = time.time()
    if not p_name: return {"has_newer": False, "ts": ts}
    
    safe_name = re.sub(r'[^\w\-_\. ]', '_', str(p_name))
    proj_path = os.path.join(canvas_state.projects_dir, f"{safe_name}.infcanvas")
    autosave_path = os.path.join(canvas_state.autosaves_dir, f"{safe_name}.infcanvas")
    
    if os.path.exists(autosave_path):
        autosave_mtime = os.path.getmtime(autosave_path)
        if os.path.exists(proj_path):
            proj_mtime = os.path.getmtime(proj_path)
            if autosave_mtime > proj_mtime:
                return {"has_newer": True, "ts": ts}
        else:
            return {"has_newer": True, "ts": ts}
            
    return {"has_newer": False, "ts": ts}

def api_sam_predict(payload_json):
    if not payload_json: return {"error": "Empty payload"}
    try:
        import json
        import os
        from io import BytesIO
        import base64
        from PIL import Image
        
        data = json.loads(payload_json)
        points = data.get("points") # list of [x, y]
        image_b64 = data.get("image")
        if not points or not image_b64: return {"error": "Missing points or image"}

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
                    return {"type": "error", "message": "Failed to download SAM model. Please check the console."}

            try:
                sam2_model = SAM(sam_model_path)
            except Exception as e:
                print(f"[Infinite Canvas] Error loading SAM 2.1 model: {e}")
                return {"type": "error", "message": "Failed to load SAM model. Please check the console."}

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

                return {
                    "type": "sam_result",
                    "mask": mask_b64
                }
            else:
                print("[Infinite Canvas] SAM found no object at the given point.")
                return {"type": "error", "message": "No object found at the clicked point."}
    except Exception as e:
        print(f"[Infinite Canvas] SAM Predict Error: {e}")
        import traceback
        traceback.print_exc()
        return {"type": "error", "message": str(e)}
    return {"error": "Unknown SAM predict error"}


