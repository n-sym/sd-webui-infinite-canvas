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
from scripts.pipeline_types import GenerationCtx, GenerationStep
from scripts.plugins.llm_prompt_optimize import LLMPromptOptimizeStep
from scripts.plugins.append_close_up import AppendCloseUpStep
from scripts.plugins.prompt_review import PromptReviewStep
from scripts.plugins.latent_blend import LatentBlendStep
from scripts.plugins.second_pass import SecondPassStep
from scripts.plugins.edge_fix import EdgeFixStep
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
    ctx.final_payload = json.dumps(payload)
    return ctx

class ParseInputStep(GenerationStep):
    id = "parse_input"
    name = "Core: Parse Input"
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
        
        if prep_info.get('is_empty_canvas', False):
            print("[Infinite Canvas] Blank canvas detected. Will use txt2img processing.")
            
        return ctx





class SetupProcessingStep(GenerationStep):
    id = "setup_processing"
    name = "Core: Setup SD"
    sort_index = 20
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        if ctx.prep_info.get('is_empty_canvas', False):
            p = processing.StableDiffusionProcessingTxt2Img(
                sd_model=shared.sd_model,
                outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_txt2img_samples,
                outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_txt2img_grids,
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
            )
        else:
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




def api_apply(feather_radius):
    try:
        feather = float(feather_radius)
        canvas_state.apply_pending_result(feather)
        payload = canvas_state.get_tiles_payload()
        payload["type"] = "apply"
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


def reset_canvas():
    canvas_state.clear()
    payload = canvas_state.get_tiles_payload()
    payload["type"] = "session_clear"
    return json.dumps(payload), gr.update(interactive=False), gr.update(interactive=False)


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
def api_list_projects():
    if not os.path.exists(canvas_state.projects_dir):
        return []
    projects = [f[:-10] for f in os.listdir(canvas_state.projects_dir) if f.endswith(".infcanvas")]
    return sorted(projects)

def api_list_projects_json():
    import json, os
    if not os.path.exists(canvas_state.projects_dir):
        return json.dumps([])
    
    projects = []
    for f in os.listdir(canvas_state.projects_dir):
        if f.endswith(".infcanvas"):
            p_name = f[:-10]
            p_path = os.path.join(canvas_state.projects_dir, f)
            p_time = os.path.getmtime(p_path)
            projects.append({"name": p_name, "mtime": p_time})
            
    projects.sort(key=lambda x: x["mtime"], reverse=True)
    return json.dumps(projects)

def api_save_project(payload_json, p_prompt, p_neg, p_steps, p_cfg, p_shift, p_denoise, p_sampler, p_scheduler, p_w, p_h, p_seed, p_fill, p_outpaint_pad, p_up, p_down, p_name, p_auto_scale):
    import json, zipfile, os, base64, re
    from io import BytesIO
    from PIL import Image
    data = json.loads(payload_json) if payload_json else {}
    viewport = data.get("viewport", {})
    mask_b64 = data.get("mask", "")

    meta = {
        "version": 2,
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
                        img_id = id(img)
                        if img_id in canvas_state.tile_webp_cache:
                            return (f"{base_name}_t_{_tx * 1024}_{_ty * 1024}.webp", canvas_state.tile_webp_cache[img_id])
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

    safe_name = re.sub(r'[^\w\-_\. ]', '_', str(p_name)) if p_name else "project"
    if not safe_name: safe_name = "project"
    
    canvas_state.current_project_name = safe_name
    
    os.makedirs(canvas_state.projects_dir, exist_ok=True)
    file_path = os.path.join(canvas_state.projects_dir, f"{safe_name}.infcanvas")
    with open(file_path, "wb") as f:
        f.write(zip_buffer.getvalue())

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

def api_load_project(p_name, recover_autosave=False, *args):
    print(f"[DEBUG] api_load_project called with p_name: '{p_name}', recover_autosave: {recover_autosave}")
    if not p_name:
        print("[DEBUG] p_name is empty, returning skips")
        return [gr.skip()] * 20
        
    try:
        import os, json, re
        safe_name = re.sub(r'[^\w\-_\. ]', '_', str(p_name))
        
        filepath = os.path.join(canvas_state.projects_dir, f"{safe_name}.infcanvas")
        if recover_autosave:
            autosave_filepath = os.path.join(canvas_state.autosaves_dir, f"{safe_name}.infcanvas")
            if os.path.exists(autosave_filepath):
                filepath = autosave_filepath
                print(f"[DEBUG] Recovering autosave from: {filepath}")
        
        print(f"[DEBUG] Loading from filepath: {filepath}")
        if not os.path.exists(filepath):
            print("[DEBUG] Filepath does not exist!")
            return [gr.skip()] * 20
            
        loaded_name = safe_name
        canvas_state.current_project_name = loaded_name
        meta, mask_b64 = _load_zip_into_canvas_state(filepath)
        print("[DEBUG] Successfully loaded zip into canvas state")

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
            gr.update(value=loaded_name)
        ]
    except Exception as e:
        import traceback
        print(f"Error loading project: {e}")
        traceback.print_exc()
        return [json.dumps({"type": "error", "message": f"Failed to load project: {e}"})] + [gr.skip()]*19


def api_import_project(*args):
    import os, shutil, re
    file_info = args[0] if args else None
    if file_info is None:
        return [gr.skip()] * 21
        
    try:
        filepath = file_info.name if hasattr(file_info, "name") else file_info
        basename = os.path.basename(filepath)
        safe_name = re.sub(r'[^\w\-_\. ]', '_', os.path.splitext(basename)[0])
        
        new_filepath = os.path.join(canvas_state.projects_dir, f"{safe_name}.infcanvas")
        shutil.copy2(filepath, new_filepath)
        
        return api_load_project(safe_name) + [gr.update(value=None)]
    except Exception as e:
        import json
        print(f"Error importing project: {e}")
        return [json.dumps({"type": "error", "message": f"Failed to import project: {e}"})] + [gr.skip()]*19 + [gr.update(value=None)]


def api_set_autosave(enabled):
    canvas_state.autosave_enabled = bool(enabled)
    return None

def api_check_autosave():
    status = getattr(canvas_state, "autosave_status", "idle")
    if status == "done":
        canvas_state.autosave_status = "idle"
    return status

def api_check_project_autosave(p_name):
    import os, json, re
    if not p_name: return json.dumps({"has_newer": False})
    
    safe_name = re.sub(r'[^\w\-_\. ]', '_', str(p_name))
    proj_path = os.path.join(canvas_state.projects_dir, f"{safe_name}.infcanvas")
    autosave_path = os.path.join(canvas_state.autosaves_dir, f"{safe_name}.infcanvas")
    
    if os.path.exists(autosave_path):
        autosave_mtime = os.path.getmtime(autosave_path)
        if os.path.exists(proj_path):
            proj_mtime = os.path.getmtime(proj_path)
            if autosave_mtime > proj_mtime:
                return json.dumps({"has_newer": True})
        else:
            return json.dumps({"has_newer": True})
            
    return json.dumps({"has_newer": False})

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


