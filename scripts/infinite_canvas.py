import os

# --- Cleanup TMP folder (Executed on WebUI startup) ---
try:
    import shutil
    tmp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))), 'tmp')
    if os.path.exists(tmp_dir):
        shutil.rmtree(tmp_dir)
        print("[Infinite Canvas] Cleaned up temporary directory.")
except Exception as e:
    print("[Infinite Canvas] Failed to clean tmp directory:", e)
# ----------------------------------------------

# --- JS BUILDER (Executed on WebUI startup) ---
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
        print("[Infinite Canvas] Successfully built javascript/infinite_canvas.js from src/js/")
except Exception as e:
    print("[Infinite Canvas] Failed to build JS:", e)
# ----------------------------------------------

import gradio as gr
import json
from modules import script_callbacks, processing, shared, sd_samplers, sd_schedulers, ui_toprow
from scripts.canvas_state import canvas_state
import base64
from modules.call_queue import wrap_gradio_gpu_call
from io import BytesIO
from PIL import Image
from modules import scripts
from modules.torch_utils import float64
import torch

# Global reference for the SAM model to allow lazy loading and memory freeing
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


def api_generate(id_task, payload_json, prompt, negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill_idx, outpaint_pad, upscaler_name, auto_scale, downscale_algo, edge_fix, edge_fix_power, latent_blend, latent_blend_power):
    edge_fix_power = float(edge_fix_power) if edge_fix_power is not None else 1.0
    latent_blend_power = float(latent_blend_power) if latent_blend_power is not None else 1.0
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

    try:
        data = json.loads(payload_json)
        source_rect = data['source_rect']
        target_rect = data['target_rect']
        mask_base64 = data.get('mask_base64', '')
        seed = int(seed) if seed is not None else -1
        shift = float(shift) if shift is not None else 3.0
        gen_width = int(gen_width) if gen_width is not None else 1024
        gen_height = int(gen_height) if gen_height is not None else 1024
        inpainting_fill_idx = int(inpainting_fill_idx) if inpainting_fill_idx is not None else 1
        outpaint_pad = str(outpaint_pad) if outpaint_pad is not None else "全黑 (Black)"
        auto_scale = bool(auto_scale)
        edge_fix = bool(edge_fix)
        
        # Prepare the canvas
        generation_res = max(gen_width, gen_height)
        prep_info = canvas_state.prepare_generation(source_rect, target_rect, generation_res=generation_res, upscaler_name=upscaler_name, mask_base64=mask_base64, auto_scale=auto_scale, outpaint_pad=outpaint_pad)
        if not prep_info:
            return json.dumps({"image": canvas_state.get_base64()}), ""
            
        init_image = prep_info['image']
        mask = prep_info['mask']
        paste_mask = prep_info.get('paste_mask', mask)
        canvas_source_rect = prep_info['canvas_source_rect']
        
        # Call processing
        p = processing.StableDiffusionProcessingImg2Img(
            sd_model=shared.sd_model,
            outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_img2img_samples,
            outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_img2img_grids,
            prompt=prompt,
            negative_prompt=negative_prompt,
            styles=[],
            seed=seed,
            subseed=-1,
            subseed_strength=0,
            seed_resize_from_h=0,
            seed_resize_from_w=0,
            seed_enable_extras=False,
            sampler_name=sampler_name,
            scheduler=scheduler,
            batch_size=1,
            n_iter=1,
            steps=steps,
            cfg_scale=cfg_scale,
            distilled_cfg_scale=shift,
            width=gen_width,
            height=gen_height,
            restore_faces=False,
            tiling=False,
            init_images=[init_image],
            mask=mask,
            mask_blur=4,
            inpainting_fill=inpainting_fill_idx, # Expose user choice
            resize_mode=0,
            denoising_strength=denoising_strength,
            image_cfg_scale=None,
            inpaint_full_res=False, # We already cropped it manually
            inpaint_full_res_padding=0,
            inpainting_mask_invert=0,
        )
        p.script_args = (float(latent_blend_power), )
        p.extra_generation_params["IC Upscaler"] = upscaler_name
        p.extra_generation_params["IC Auto Scale"] = auto_scale
        
        # Prepare edge masks if either feature is requested
        if edge_fix or latent_blend:
            import cv2
            import numpy as np
            edge_radius = max(1, int(max(gen_width, gen_height) * 0.025))
            mask_gen_size_arr = cv2.resize(np.array(mask), (gen_width, gen_height), interpolation=cv2.INTER_NEAREST)
            
            if latent_blend:
                # Create a symmetric softly feathered mask for Latent Blend
                ksize = int(edge_radius) * 2 + 1
                symmetric_soft_mask_arr = cv2.GaussianBlur(mask_gen_size_arr, (ksize, ksize), 0)
                
                p.image_mask = Image.fromarray(symmetric_soft_mask_arr)
                p.mask_round = False # CRITICAL: prevent A1111 from destroying the soft edges
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
        
        processed = processing.process_images(p)
        
        if processed.images:
            result_img = processed.images[0]
            original_paste_mask_arr = np.array(paste_mask.convert("L"))
            
            if latent_blend and not edge_fix:
                paste_mask_arr = cv2.max(original_paste_mask_arr, symmetric_soft_mask_arr)
                paste_mask_arr[paste_mask_arr > 0] = 255
                paste_mask = Image.fromarray(paste_mask_arr)

            if edge_fix:
                import cv2
                import numpy as np
                from modules import images as a1111_images
                
                # 1. Delta calculation
                # Use A1111's exact resize algorithm so the diff is pixel-perfect
                img_in_resized = a1111_images.resize_image(0, p.init_images[0], gen_width, gen_height)
                img_in_arr = np.array(img_in_resized).astype(np.int32)
                
                img_out_arr = np.array(result_img).astype(np.int32)
                
                delta = np.abs(img_out_arr - img_in_arr)
                delta_max = np.max(delta, axis=2)
                
                # Binarize
                delta_mask = (delta_max > 5).astype(np.uint8) * 255
                
                # Morphological operations
                kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
                
                delta_mask = cv2.morphologyEx(delta_mask, cv2.MORPH_OPEN, kernel_open)
                delta_mask = cv2.morphologyEx(delta_mask, cv2.MORPH_CLOSE, kernel_close)
                
                # Intersect with safe expanded mask bounding box
                safe_mask = cv2.dilate(mask_gen_size_arr, np.ones((int(edge_radius)*2+1, int(edge_radius)*2+1), np.uint8))
                actual_mask_arr = cv2.bitwise_and(delta_mask, safe_mask)
                
                if np.max(actual_mask_arr) == 0:
                    # Nothing changed in Pass 1, so there is no edge to fix!
                    blured_edge_mask_arr = np.zeros((gen_height, gen_width), dtype=np.uint8)
                    hard_edge_mask_arr = np.zeros((gen_height, gen_width), dtype=np.uint8)
                else:
                    # 2. Distance transform
                    down_factor = 4
                    small_w = max(1, gen_width // down_factor)
                    small_h = max(1, gen_height // down_factor)
                    small_actual = cv2.resize(actual_mask_arr, (small_w, small_h), interpolation=cv2.INTER_NEAREST)
                    
                    dist_in_eff = cv2.distanceTransform(small_actual, cv2.DIST_L2, 3)
                    dist_out_eff = cv2.distanceTransform(cv2.bitwise_not(small_actual), cv2.DIST_L2, 3)
                    dist_to_edge = (dist_in_eff + dist_out_eff) * down_factor
                    
                    sigma = max(1, edge_radius / 3.0)
                    edge_mask_float = np.exp(- (dist_to_edge**2) / (2 * sigma**2))
                    edge_mask_dist_arr = (edge_mask_float * 255).astype(np.uint8)
                    
                    large_edge_mask = cv2.resize(edge_mask_dist_arr, (gen_width, gen_height), interpolation=cv2.INTER_LINEAR)
                    
                    # Apply multiple passes of a large blur to create an ultra-soft alpha transition
                    blur_k = int(edge_radius) * 2 + 1
                    if blur_k % 2 == 0: blur_k += 1
                    blured_edge_mask_arr = cv2.GaussianBlur(large_edge_mask, (blur_k, blur_k), 0)
                    blured_edge_mask_arr = cv2.GaussianBlur(blured_edge_mask_arr, (blur_k, blur_k), 0)
                    blured_edge_mask_arr = cv2.GaussianBlur(blured_edge_mask_arr, (blur_k, blur_k), 0)
                    
                    hard_edge_mask_arr = np.copy(blured_edge_mask_arr)
                    hard_edge_mask_arr[hard_edge_mask_arr > 0] = 255
                    
                    hard_edge_mask = Image.fromarray(hard_edge_mask_arr)
                    
                    p2 = processing.StableDiffusionProcessingImg2Img(
                        sd_model=shared.sd_model, outpath_samples=shared.opts.outdir_samples or shared.opts.outdir_img2img_samples, outpath_grids=shared.opts.outdir_grids or shared.opts.outdir_img2img_grids,
                        prompt=prompt, negative_prompt=negative_prompt, seed=seed, subseed=-1, subseed_strength=0, seed_resize_from_h=0, seed_resize_from_w=0, seed_enable_extras=False,
                        sampler_name=sampler_name, scheduler=scheduler, batch_size=1, n_iter=1, steps=max(1, int(steps * 0.2 * edge_fix_power)),
                        cfg_scale=cfg_scale, distilled_cfg_scale=shift, width=gen_width, height=gen_height, restore_faces=False, tiling=False,
                        init_images=[result_img], mask=hard_edge_mask, mask_blur=4, inpainting_fill=inpainting_fill_idx, resize_mode=0,
                        denoising_strength=(- (denoising_strength ** 2) / (2 * edge_fix_power) + denoising_strength), image_cfg_scale=None, inpaint_full_res=False, inpaint_full_res_padding=0, inpainting_mask_invert=0
                    )
                    p2.script_args = (float(latent_blend_power), )
                    
                    processed2 = processing.process_images(p2)
                    if processed2.images:
                        inpaint_image_2 = processed2.images[0]
                        base_arr = np.array(result_img).astype(np.float32)
                        new_arr = np.array(inpaint_image_2).astype(np.float32)
                        alpha = (blured_edge_mask_arr / 255.0)[:, :, np.newaxis]
                        final_blended_arr = base_arr * (1.0 - alpha) + new_arr * alpha
                        result_img = Image.fromarray(final_blended_arr.astype(np.uint8))
                
                paste_mask_arr = cv2.max(original_paste_mask_arr, cv2.max(actual_mask_arr, hard_edge_mask_arr))
                paste_mask_arr[paste_mask_arr > 0] = 255
                paste_mask = Image.fromarray(paste_mask_arr)
            
            # Defer pasting - save to pending state
            edge_fix_mask_img = Image.fromarray(blured_edge_mask_arr) if edge_fix and 'blured_edge_mask_arr' in locals() else None
            canvas_state.set_pending_result(result_img, canvas_source_rect, paste_mask, downscale_algo, edge_fix_mask=edge_fix_mask_img)
            
            def to_b64(img):
                buffered = BytesIO()
                img.save(buffered, format="PNG", compress_level=1)
                return "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")
                
            patch_b64 = to_b64(canvas_state.pending_data['patch'])
            mask_b64 = to_b64(canvas_state.pending_data['mask_rgba'])
            edge_mask_b64 = to_b64(canvas_state.pending_data['edge_mask_rgba']) if 'edge_mask_rgba' in canvas_state.pending_data else None
            
            payload = {
                "type": "preview",
                "image": canvas_state.get_base64(), # The base canvas (might have been padded/scaled)
                "patch": patch_b64,
                "mask": mask_b64,
                "transform": {
                    "scale": prep_info['transform']['scale'],
                    "pad_left": prep_info['transform']['pad_left'],
                    "pad_top": prep_info['transform']['pad_top'],
                    "rect_x": canvas_source_rect['x'],
                    "rect_y": canvas_source_rect['y']
                }
            }
            if edge_mask_b64:
                payload["edge_mask"] = edge_mask_b64
                
            return json.dumps(payload), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo()), ""
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return "", gr.update(), gr.update(), f"Error: {str(e)}"
    
    return "", gr.update(), gr.update(), ""

def api_apply(feather_radius):
    try:
        feather = float(feather_radius)
        canvas_state.apply_pending_result(feather)
        return json.dumps({
            "type": "apply",
            "image": canvas_state.get_base64()
        }), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())
    except Exception as e:
        import traceback
        traceback.print_exc()
        return "", gr.update(), gr.update()
        
def api_discard():
    try:
        canvas_state.discard_pending_result()
        return json.dumps({
            "type": "discard",
            "image": canvas_state.get_base64()
        }), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())
    except Exception as e:
        import traceback
        traceback.print_exc()
        return "", gr.update(), gr.update()
        
def api_check_session():
    if canvas_state.is_dirty:
        return json.dumps({
            "type": "session_check",
            "has_session": True,
            "preview": canvas_state.get_thumbnail_base64()
        })
    else:
        return json.dumps({
            "type": "session_check",
            "has_session": False
        })
        
def api_restore_session():
    return json.dumps({
        "type": "session_restore",
        "image": canvas_state.get_base64()
    })
    
def api_clear_session():
    canvas_state.clear()
    return json.dumps({
        "type": "session_clear",
        "image": canvas_state.get_base64()
    })

def on_ui_tabs():
    with gr.Blocks(analytics_enabled=False) as infinite_canvas_interface:
        with gr.Row():
            with gr.Column(scale=3):
                # We will mount our custom canvas here using JS.
                gr.HTML(value='<div id="ic-container" style="width:100%; height:80vh; min-height:600px; max-height:1200px; border:1px solid #ccc; position:relative; overflow:hidden; background:#333; cursor:crosshair;"><canvas id="ic-canvas"></canvas></div>')
                
                with gr.Row(elem_id="ic_toolbar_1", equal_height=False, visible=False):
                    prev_btn = gr.Button("Canvas ⏪", elem_id="ic_prev_btn", interactive=False, size="sm", scale=0)
                    now_btn = gr.Button("Canvas ⏩", elem_id="ic_now_btn", interactive=False, size="sm", scale=0)
                    ic_tool_rect = gr.Button("Rect", elem_id="ic_tool_rect", size="sm", min_width=80, scale=0, variant="primary")
                    ic_tool_brush = gr.Button("Brush", elem_id="ic_tool_brush", size="sm", min_width=80, scale=0, variant="secondary")
                    ic_tool_ellipse = gr.Button("Ellipse", elem_id="ic_tool_ellipse", size="sm", min_width=80, scale=0, variant="secondary")
                    ic_tool_eraser = gr.Button("Eraser", elem_id="ic_tool_eraser", size="sm", min_width=80, scale=0, variant="secondary")
                    ic_show_overlay_btn = gr.Button("Show Overlays", elem_id="ic_show_overlay_btn", size="sm", scale=0, variant="primary")
                    ic_auto_scale_btn = gr.Button("Auto Scale Canvas", elem_id="ic_auto_scale_btn", size="sm", scale=0, variant="primary")
                    ic_show_overlay = gr.Checkbox(value=True, elem_id="ic_show_overlay", elem_classes="ic-hide")
                    ic_auto_scale = gr.Checkbox(value=True, elem_id="ic_auto_scale", elem_classes="ic-hide")
                    gr.HTML("<style>.ic-hide { display: none !important; }</style>", scale=1)
                
                with gr.Row(elem_id="ic_toolbar_2", equal_height=False, visible=False):
                    gr.HTML('''
<style>
.res-preset-container {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    align-items: center;
    height: 100%;
    min-width: 370px;
}
.res-preset-btn {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--button-secondary-background-fill, #333);
    border: 1px solid var(--button-secondary-border-color, #555);
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
}
.res-preset-btn:hover {
    background: var(--button-secondary-background-fill-hover, #444);
}
.res-preset-icon {
    border: 2px solid var(--body-text-color, #ccc);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: var(--body-text-color, #ccc);
    font-weight: bold;
    border-radius: 2px;
    box-sizing: border-box;
    overflow: hidden;
}
</style>
<div class="res-preset-container">
    <div class="res-preset-btn" onclick="ic_setRes(1024,1024)" title="1024 x 1024">
        <div class="res-preset-icon" style="width: 24px; height: 24px;">1K</div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(832,1216)" title="832 x 1216">
        <div class="res-preset-icon" style="width: 16px; height: 24px;"><span style="transform: scale(0.85);">1K</span></div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(1216,832)" title="1216 x 832">
        <div class="res-preset-icon" style="width: 24px; height: 16px;">1K</div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(1024,1280)" title="1024 x 1280">
        <div class="res-preset-icon" style="width: 19px; height: 24px;"><span style="transform: scale(0.85);">1K</span></div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(1280,1024)" title="1280 x 1024">
        <div class="res-preset-icon" style="width: 24px; height: 19px;"><span style="transform: scale(0.85);">1K</span></div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(768,1344)" title="768 x 1344">
        <div class="res-preset-icon" style="width: 14px; height: 24px;"><span style="transform: scale(0.75);">1K</span></div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(1344,768)" title="1344 x 768">
        <div class="res-preset-icon" style="width: 24px; height: 14px;"><span style="transform: scale(0.75);">1K</span></div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(704,1472)" title="704 x 1472">
        <div class="res-preset-icon" style="width: 11px; height: 24px;"><span style="transform: scale(0.65);">1K</span></div>
    </div>
    <div class="res-preset-btn" onclick="ic_setRes(1472,704)" title="1472 x 704">
        <div class="res-preset-icon" style="width: 24px; height: 11px;"><span style="transform: scale(0.65);">1K</span></div>
    </div>
</div>''', elem_id="ic_res_preset_html", scale=1)
                    
                    ic_clear_mask = gr.Button("Clear Mask", elem_id="ic_clear_mask", size="sm", scale=0)
                    reset_btn_ui = gr.Button("Reset Canvas", elem_id="ic_reset_btn", size="sm", scale=0)
                    download_btn = gr.Button("Download Canvas", elem_id="ic_download_btn", size="sm", scale=0)
                    copy_btn = gr.Button("Copy Canvas", elem_id="ic_copy_btn", size="sm", scale=0)
                    ic_guide_btn = gr.Button("📖 Guide", elem_id="ic_guide_btn", size="sm", scale=0)
                    reset_btn = gr.Button("Reset Canvas Hidden", elem_id="ic_reset_btn_hidden", visible=False)
                    gr.HTML("", scale=1)
                
            with gr.Column(scale=1):
                toprow = ui_toprow.Toprow(is_img2img=True, id_part="ic", is_compact=True)
                toprow.create_inline_toprow_prompts()
                toprow.create_inline_toprow_image()
                
                with gr.Accordion("Upload Base Image", open=False, elem_id="ic_accordion_upload"):
                    upload_image = gr.Image(type="pil", label="Upload Base Image", elem_id="ic_upload_image")
                
                with gr.Accordion("Project Management", open=False, elem_id="ic_accordion_project"):
                    ic_project_name = gr.Textbox(label="Project Name", value="project", elem_id="ic_project_name")
                    with gr.Row():
                        ic_save_project_btn = gr.Button("Save Project", elem_id="ic_save_project_btn", variant="primary")
                        ic_load_project_btn = gr.Button("Load Project", elem_id="ic_load_project_btn", variant="primary")
                    
                    ic_download_file = gr.File(label="Download Project Archive", interactive=False, visible=False, elem_id="ic_download_file")
                    ic_upload_file = gr.File(label="Upload Project Archive", file_types=[".infcanvas", ".zip"], visible=False, elem_id="ic_upload_file")

                
                from modules import shared
                preset = shared.opts.data.get("forge_preset", "sd")
                default_step = shared.opts.data.get(f"{preset}_i2i_step", 20)
                default_cfg = shared.opts.data.get(f"{preset}_i2i_cfg", 6.0)
                default_shift = shared.opts.data.get(f"{preset}_i2i_dcfg", 3.0)
                default_sampler = shared.opts.data.get(f"{preset}_i2i_sampler", "Euler a")
                default_scheduler = shared.opts.data.get(f"{preset}_i2i_scheduler", "Automatic")
                
                with gr.Accordion("Generation Parameters", open=False, elem_id="ic_accordion_gen"):
                    steps = gr.Slider(minimum=1, maximum=150, step=1, label="Sampling Steps", value=default_step, elem_id="ic_steps")
                    with gr.Row():
                        cfg_scale = gr.Slider(minimum=1.0, maximum=30.0, step=0.5, label="CFG Scale", value=default_cfg, elem_id="ic_cfg")
                        shift = gr.Slider(minimum=1.0, maximum=24.0, step=0.5, label="Shift", value=default_shift, elem_id="ic_shift")
                    denoising_strength = gr.Slider(minimum=0.0, maximum=1.0, step=0.01, label="Denoising Strength", value=0.6, elem_id="ic_denoising")
                    
                    with gr.Row():
                        sampler_name = gr.Dropdown(choices=[x.name for x in sd_samplers.all_samplers], value=default_sampler, label="Sampling Method", elem_id="ic_sampler")
                        scheduler = gr.Dropdown(choices=["Automatic"] + [x.label for x in sd_schedulers.schedulers], value=default_scheduler, label="Schedule Type", elem_id="ic_scheduler")
                    seed = gr.Number(label="Seed", value=-1, elem_id="ic_seed")

                with gr.Accordion("Canvas & Mask Parameters", open=False, elem_id="ic_accordion_canvas"):
                    with gr.Row():
                        gen_width = gr.Slider(minimum=64, maximum=2048, step=8, label="Width", value=1024, elem_id="ic_gen_width")
                        gen_height = gr.Slider(minimum=64, maximum=2048, step=8, label="Height", value=1024, elem_id="ic_gen_height")
                        
                    with gr.Row():
                        inpainting_fill = gr.Radio(label="Masked content", choices=["fill", "original", "latent noise", "latent nothing"], value="original", type="index")
                        ic_outpaint_pad = gr.Radio(label="Edge Padding", choices=["Black", "White", "Extend Edge", "Edge Blur"], value="Black", elem_id="ic_outpaint_pad")
                        
                    from modules import shared
                    upscaler_name_input = gr.Dropdown(label="Upscaler (for resizing source)", choices=[x.name for x in shared.sd_upscalers], value="None")
                    downscale_algo_input = gr.Dropdown(label="Downscale Algorithm", choices=["Bicubic", "Lanczos", "Bilinear", "Nearest"], value="Bicubic")
                    with gr.Row():
                        ic_edge_fix = gr.Checkbox(label="Edge Fix", value=True, elem_id="ic_edge_fix")
                        ic_edge_fix_power = gr.Slider(label="Edge Fix Power (t)", minimum=0.5, maximum=2.5, step=0.1, value=1.0, elem_id="ic_edge_fix_power")
                        
                    ic_edge_fix.change(
                        fn=lambda x: gr.update(visible=x),
                        inputs=[ic_edge_fix],
                        outputs=[ic_edge_fix_power]
                    )
                    
                    with gr.Row():
                        ic_latent_blend = gr.Checkbox(label="Latent Edge Blend (Unsafe)", value=False, elem_id="ic_latent_blend")
                        ic_latent_blend_power = gr.Slider(label="Dynamic Blend Power (0=Static)", minimum=0.0, maximum=2.0, step=0.1, value=1.0, elem_id="ic_latent_blend_power", visible=False)
                        
                    ic_latent_blend.change(
                        fn=lambda x: gr.update(visible=x),
                        inputs=[ic_latent_blend],
                        outputs=[ic_latent_blend_power]
                    )

                # Hidden inputs/outputs for JS interop
                with gr.Group(visible=False):
                    dummy_component = gr.Textbox(visible=False)
                    payload_input = gr.Textbox(elem_id="ic_payload")
                    payload_output = gr.Textbox(elem_id="ic_output")
                    trigger_btn = gr.Button("Trigger", elem_id="ic_trigger")
                    
                    apply_feather_input = gr.Number(value=0, elem_id="ic_apply_feather_input")
                    apply_btn = gr.Button("Apply", elem_id="ic_apply_hidden")
                    discard_btn = gr.Button("Discard", elem_id="ic_discard_hidden")
                    
                    check_session_btn = gr.Button("Check Session", elem_id="ic_check_session_btn")
                    restore_session_btn = gr.Button("Restore Session", elem_id="ic_restore_session_btn")
                    clear_session_btn = gr.Button("Clear Session", elem_id="ic_clear_session_btn")
                    
                    sam_payload_input = gr.Textbox(elem_id="ic_sam_payload_input")
                    sam_predict_btn = gr.Button("SAM Predict", elem_id="ic_sam_predict_btn")
                
                html_info = gr.HTML(elem_id="ic_html_info")
                
                apply_btn.click(
                    fn=api_apply,
                    inputs=[apply_feather_input],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                discard_btn.click(
                    fn=api_discard,
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                trigger_btn.click(
                    fn=wrap_gradio_gpu_call(api_generate, extra_outputs=[gr.update(), gr.update(), ""]),
                    _js="function(){ var args = Array.from(arguments); args[0] = window.ic_current_task_id || 'ic_task'; return args; }",
                    inputs=[dummy_component, payload_input, toprow.prompt, toprow.negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill, ic_outpaint_pad, upscaler_name_input, ic_auto_scale, downscale_algo_input, ic_edge_fix, ic_edge_fix_power, ic_latent_blend, ic_latent_blend_power],
                    outputs=[payload_output, prev_btn, now_btn, html_info],
                )
                
                def reset_canvas():
                    from scripts.canvas_state import CanvasState
                    import scripts.canvas_state
                    scripts.canvas_state.canvas_state = CanvasState()
                    return json.dumps({"image": scripts.canvas_state.canvas_state.get_base64()}), gr.update(interactive=False), gr.update(interactive=False)
                    
                reset_btn_ui.click(
                    fn=None,
                    _js="function(){ if(confirm(t('Are you sure you want to completely reset the canvas? This cannot be undone.'))) document.getElementById('ic_reset_btn_hidden').click(); return []; }",
                    inputs=[],
                    outputs=[]
                )
                
                reset_btn.click(
                    fn=reset_canvas,
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                def toggle_state(state):
                    if state == 'prev' and canvas_state.image_prev:
                        canvas_state.image = canvas_state.image_prev.copy()
                    elif state == 'now' and canvas_state.image_now:
                        canvas_state.image = canvas_state.image_now.copy()
                    return json.dumps({"image": canvas_state.get_base64()}), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())
                    
                prev_btn.click(
                    fn=lambda: toggle_state('prev'),
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                now_btn.click(
                    fn=lambda: toggle_state('now'),
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                def handle_upload(image):
                    if image is not None:
                        canvas_state.load_image(image)
                    return json.dumps({"image": canvas_state.get_base64()}), gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo())
                    
                upload_image.change(
                    fn=handle_upload,
                    inputs=[upload_image],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                check_session_btn.click(
                    fn=api_check_session,
                    inputs=[],
                    outputs=[payload_output]
                )
                
                restore_session_btn.click(
                    fn=api_restore_session,
                    inputs=[],
                    outputs=[payload_output]
                )
                
                clear_session_btn.click(
                    fn=api_clear_session,
                    inputs=[],
                    outputs=[payload_output]
                )
                
                def api_save_project(payload_json, p_prompt, p_neg, p_steps, p_cfg, p_shift, p_denoise, p_sampler, p_scheduler, p_w, p_h, p_seed, p_fill, p_outpaint_pad, p_up, p_down, p_name, p_auto_scale, p_edge_fix, p_edge_fix_power, p_latent_blend, p_latent_blend_power):
                    import json, zipfile, os, base64, re
                    from io import BytesIO
                    from PIL import Image
                    data = json.loads(payload_json) if payload_json else {}
                    viewport = data.get("viewport", {})
                    mask_b64 = data.get("mask", "")
                    
                    meta = {
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
                        "edge_fix": p_edge_fix,
                        "edge_fix_power": p_edge_fix_power,
                        "latent_blend": p_latent_blend,
                        "latent_blend_power": p_latent_blend_power
                    }
                    
                    zip_buffer = BytesIO()
                    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
                        import concurrent.futures
                        
                        image_sizes = {}
                        futures = []
                        executor = concurrent.futures.ThreadPoolExecutor()
                        
                        def add_image_tiles(img, base_name):
                            if img:
                                img.load() # ensure the image is fully loaded before multithreading
                                image_sizes[base_name] = img.size
                                w, h = img.size
                                tile_size = 1024
                                for y in range(0, h, tile_size):
                                    for x in range(0, w, tile_size):
                                        box = (x, y, min(x + tile_size, w), min(y + tile_size, h))
                                        def process_tile(crop_box=box):
                                            tile = img.crop(crop_box)
                                            img_io = BytesIO()
                                            tile.save(img_io, format="WEBP", lossless=True, quality=100, method=4)
                                            return (f"{base_name}_t_{crop_box[0]}_{crop_box[1]}.webp", img_io.getvalue())
                                        futures.append(executor.submit(process_tile))

                        add_image_tiles(canvas_state.image, "canvas")
                        add_image_tiles(canvas_state.image_prev, "canvas_prev")
                        add_image_tiles(canvas_state.image_now, "canvas_now")
                        
                        if mask_b64 and "," in mask_b64:
                            try:
                                m_img = Image.open(BytesIO(base64.b64decode(mask_b64.split(",")[1])))
                                add_image_tiles(m_img, "mask")
                            except Exception:
                                pass
                                
                        meta["image_sizes"] = image_sizes
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

                            def load_img(base_name, is_mask=False):
                                mode = "RGBA" if is_mask else "RGB"
                                # 1. Try loading from tiles if available
                                if meta.get("image_sizes") and base_name in meta["image_sizes"] and meta["image_sizes"][base_name]:
                                    size = meta["image_sizes"][base_name]
                                    tile_names = [n for n in zip_ref.namelist() if n.startswith(f"{base_name}_t_") and n.endswith(".webp")]
                                    if tile_names:
                                        img = Image.new(mode, tuple(size))
                                        for name in tile_names:
                                            parts = name.replace(".webp", "").split("_")
                                            x, y = int(parts[-2]), int(parts[-1])
                                            tile_data = zip_ref.read(name)
                                            tile_img = Image.open(BytesIO(tile_data))
                                            if tile_img.mode != mode:
                                                tile_img = tile_img.convert(mode)
                                            img.paste(tile_img, (x, y))
                                        return img
                                        
                                # 2. Fallback to single WEBP or PNG file
                                if f"{base_name}.webp" in zip_ref.namelist():
                                    return Image.open(BytesIO(zip_ref.read(f"{base_name}.webp"))).convert(mode)
                                elif f"{base_name}.png" in zip_ref.namelist():
                                    return Image.open(BytesIO(zip_ref.read(f"{base_name}.png"))).convert(mode)
                                return None

                            canvas_state.image = load_img("canvas")
                            canvas_state.image_prev = load_img("canvas_prev")
                            canvas_state.image_now = load_img("canvas_now")
                                
                            m_img = load_img("mask", is_mask=True)
                            if m_img:
                                m_io = BytesIO()
                                m_img.save(m_io, format="WEBP", lossless=True, quality=100, method=0)
                                mask_b64 = "data:image/webp;base64," + base64.b64encode(m_io.getvalue()).decode('utf-8')
                        
                        payload = json.dumps({
                            "type": "project_load",
                            "image": canvas_state.get_base64(),
                            "mask": mask_b64,
                            "meta": meta
                        })
                        print(f"[Infinite Canvas] Project loaded successfully (image: {len(canvas_state.get_base64())} bytes, mask: {len(mask_b64)} bytes)")

                        return [
                            payload,
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
                            meta.get("edge_fix", gr.skip()),
                            meta.get("edge_fix_power", gr.skip()),
                            meta.get("latent_blend", gr.skip()),
                            meta.get("latent_blend_power", gr.skip()),
                            gr.update(value=None),
                            gr.update(value=loaded_name)
                        ]
                    except Exception as e:
                        print(f"Error loading project: {e}")
                        return [json.dumps({"type": "error", "message": f"Failed to load project: {e}"})] + [gr.skip()]*22 + [gr.update(value=None), gr.skip()]

                # Hidden button to trigger python save
                ic_save_project_hidden_btn = gr.Button("Save Project Hidden", elem_id="ic_save_project_hidden_btn", visible=False)
                
                ic_save_project_hidden_btn.click(
                    fn=api_save_project,
                    inputs=[payload_input, toprow.prompt, toprow.negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill, ic_outpaint_pad, upscaler_name_input, downscale_algo_input, ic_project_name, ic_auto_scale, ic_edge_fix, ic_edge_fix_power, ic_latent_blend, ic_latent_blend_power],
                    outputs=[ic_download_file]
                )
                
                ic_upload_file.change(
                    fn=api_load_project,
                    inputs=[ic_upload_file],
                    outputs=[payload_output, prev_btn, now_btn, toprow.prompt, toprow.negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill, ic_outpaint_pad, upscaler_name_input, downscale_algo_input, ic_auto_scale, ic_edge_fix, ic_edge_fix_power, ic_latent_blend, ic_latent_blend_power, ic_upload_file, ic_project_name]
                )
                
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
                    
                sam_predict_btn.click(
                    fn=api_sam_predict,
                    inputs=[sam_payload_input],
                    outputs=[payload_output],
                )

                import modules.infotext_utils as parameters_copypaste
                from modules.infotext_utils import PasteField
                
                ic_paste_fields = [
                    PasteField(toprow.prompt, "Prompt", api="prompt"),
                    PasteField(toprow.negative_prompt, "Negative prompt", api="negative_prompt"),
                    PasteField(steps, "Steps", api="steps"),
                    PasteField(sampler_name, sd_samplers.get_sampler_from_infotext, api="sampler_name"),
                    PasteField(scheduler, sd_samplers.get_scheduler_from_infotext, api="scheduler"),
                    PasteField(cfg_scale, "CFG scale", api="cfg_scale"),
                    PasteField(shift, "Shift", api="shift"),
                    PasteField(denoising_strength, "Denoising strength", api="denoising_strength"),
                    PasteField(gen_width, "Size-1", api="width"),
                    PasteField(gen_height, "Size-2", api="height"),
                    PasteField(seed, "Seed", api="seed"),
                    PasteField(inpainting_fill, "Masked content", api="mask_mode"),
                    PasteField(upscaler_name_input, "IC Upscaler"),
                    PasteField(toprow.ui_styles.dropdown, lambda d: d["Styles array"] if isinstance(d.get("Styles array"), list) else gr.skip(), api="styles"),
                ]
                parameters_copypaste.add_paste_fields("infinite_canvas", None, ic_paste_fields)
                parameters_copypaste.register_paste_params_button(
                    parameters_copypaste.ParamBinding(
                        paste_button=toprow.paste,
                        tabname="infinite_canvas",
                        source_text_component=toprow.prompt,
                        source_image_component=None,
                    )
                )

    return [(infinite_canvas_interface, "Infinite Canvas", "infinite_canvas")]

script_callbacks.on_ui_tabs(on_ui_tabs)
