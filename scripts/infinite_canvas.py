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
import scripts.core_logic
import scripts.node_manager

# Global reference for the SAM model to allow lazy loading and memory freeing

def make_dynamic(func_name):
    def wrapper(*args, **kwargs):
        import sys
        mod_nm = sys.modules.get('scripts.node_manager')
        if mod_nm and hasattr(mod_nm, func_name):
            return getattr(mod_nm, func_name)(*args, **kwargs)
        
        mod_cl = sys.modules.get('scripts.core_logic')
        if mod_cl and hasattr(mod_cl, func_name):
            return getattr(mod_cl, func_name)(*args, **kwargs)
            
        # fallback
        if hasattr(scripts.node_manager, func_name):
            return getattr(scripts.node_manager, func_name)(*args, **kwargs)
        return globals().get(func_name, getattr(scripts.core_logic, func_name, None))(*args, **kwargs)
    return wrapper

def on_ui_tabs():
    with gr.Blocks(analytics_enabled=False) as infinite_canvas_interface:
        with gr.Row():
            with gr.Column(scale=3):
                # We will mount our custom canvas here using JS.
                gr.HTML(value='<div id="ic-container" style="width:100%; height:80vh; min-height:600px; max-height:1200px; border:1px solid #ccc; position:relative; overflow:hidden; cursor:crosshair;"><canvas id="ic-canvas"></canvas></div>')
                
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
                    ic_guide_btn = gr.Button("Guide", elem_id="ic_guide_btn", size="sm", scale=0)
                    reset_btn = gr.Button("Reset Canvas Hidden", elem_id="ic_reset_btn_hidden", visible=True)
                    gr.HTML("", scale=1)
                
            with gr.Column(scale=1):
                toprow = ui_toprow.Toprow(is_img2img=True, id_part="ic", is_compact=True)
                toprow.create_inline_toprow_prompts()
                toprow.create_inline_toprow_image()
                
                with gr.Accordion("Upload Base Image", open=False, elem_id="ic_accordion_upload"):
                    upload_image = gr.Image(type="pil", label="Upload Base Image", elem_id="ic_upload_image")
                

                from modules import shared
                preset = shared.opts.data.get("forge_preset", "sd")
                default_step = shared.opts.data.get(f"{preset}_i2i_step", 20)
                default_cfg = shared.opts.data.get(f"{preset}_i2i_cfg", 4.0)
                default_shift = shared.opts.data.get(f"{preset}_i2i_dcfg", 1.0)
                default_sampler = shared.opts.data.get(f"{preset}_i2i_sampler", "Euler")
                default_scheduler = shared.opts.data.get(f"{preset}_i2i_scheduler", "Beta")
                
                with gr.Accordion("Generation Parameters", open=False, elem_id="ic_accordion_gen"):
                    steps = gr.Slider(minimum=1, maximum=150, step=1, label="Sampling Steps", value=default_step, elem_id="ic_steps")
                    steps.do_not_save_to_config = True
                    with gr.Row():
                        cfg_scale = gr.Slider(minimum=1.0, maximum=30.0, step=0.5, label="CFG Scale", value=default_cfg, elem_id="ic_cfg")
                        cfg_scale.do_not_save_to_config = True
                        shift = gr.Slider(minimum=1.0, maximum=24.0, step=0.5, label="Shift", value=default_shift, elem_id="ic_shift")
                        shift.do_not_save_to_config = True
                    denoising_strength = gr.Slider(minimum=0.0, maximum=1.0, step=0.01, label="Denoising Strength", value=0.6, elem_id="ic_denoising")
                    
                    with gr.Row():
                        sampler_name = gr.Dropdown(choices=[x.name for x in sd_samplers.all_samplers], value=default_sampler, label="Sampling Method", elem_id="ic_sampler")
                        sampler_name.do_not_save_to_config = True
                        scheduler = gr.Dropdown(choices=["Automatic"] + [x.label for x in sd_schedulers.schedulers], value=default_scheduler, label="Schedule Type", elem_id="ic_scheduler")
                        scheduler.do_not_save_to_config = True
                    with gr.Row():
                        seed = gr.Number(label="Seed", value=-1, elem_id="ic_seed")
                        ic_compile_preset = gr.Dropdown(
                            label="Torch Compile Integrated (Adapter)",
                            value="Disable",
                            choices=["Disable", "guard_filter_fn", "dynamic", "max-autotune", "max-autotune-no-cudagraphs", "reduce-overhead"],
                            elem_id="ic_compile_preset"
                        )

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

                with gr.Accordion("Pipeline Nodes", open=False, elem_id="ic_accordion_workflow"):
                    workflow_html = gr.HTML(elem_id="ic_workflow_html", value="<div style='padding:10px; color:#888;'>Loading pipeline...</div>")

                with gr.Accordion("Developer", open=False, elem_id="ic_accordion_dev"):
                    with gr.Row():
                        ic_hot_reload_btn = gr.Button("Hot Reload Extension Logic", elem_id="ic_hot_reload_btn", variant="primary")
                        ic_rebuild_js_btn = gr.Button("Rebuild JS", elem_id="ic_rebuild_js_btn", variant="secondary")

                # Hidden inputs/outputs for JS interop
                with gr.Group(visible=False):
                    dummy_component = gr.Textbox(visible=False)
                    payload_input = gr.Textbox(elem_id="ic_payload")
                    payload_output = gr.Textbox(elem_id="ic_output")
                    trigger_btn = gr.Button("Trigger", elem_id="ic_trigger")
                    
                    ic_project_name_input = gr.Textbox(elem_id="ic_project_name_input")
                    ic_projects_json_output = gr.Textbox(elem_id="ic_projects_json_output")
                    ic_get_projects_btn = gr.Button("Get Projects", elem_id="ic_get_projects_btn")
                    
                    ic_recover_autosave_input = gr.Checkbox(elem_id="ic_recover_autosave_input", value=False)
                    ic_check_autosave_hidden_btn = gr.Button("Check Autosave Hidden", elem_id="ic_check_autosave_hidden_btn")
                    ic_check_autosave_output = gr.Textbox(elem_id="ic_check_autosave_output")
                    
                    ic_load_project_hidden_btn = gr.Button("Load Hidden", elem_id="ic_load_project_hidden_btn")
                    ic_import_file = gr.File(label="Import Project", file_types=[".infcanvas", ".zip"], elem_id="ic_import_file")
                    ic_autosave_enable = gr.Checkbox(label="Enable Autosave", value=True, elem_id="ic_autosave_enable")
                    ic_check_autosave_btn = gr.Button("Check Autosave", elem_id="ic_check_autosave_btn")
                    ic_autosave_status_box = gr.Textbox(elem_id="ic_autosave_status_box")
                    
                    apply_feather_input = gr.Number(value=0, elem_id="ic_apply_feather_input")
                    apply_btn = gr.Button("Apply", elem_id="ic_apply_hidden")
                    discard_btn = gr.Button("Discard", elem_id="ic_discard_hidden")
                    
                    sam_payload_input = gr.Textbox(elem_id="ic_sam_payload_input")
                    sam_predict_btn = gr.Button("SAM Predict", elem_id="ic_sam_predict_btn")
                    query_workflow_btn = gr.Button("Query Workflow", elem_id="ic_query_workflow_btn")
                    update_workflow_payload = gr.Textbox(elem_id="ic_update_workflow_payload")
                    update_workflow_btn = gr.Button("Update Workflow", elem_id="ic_update_workflow_btn")
                    
                    resume_payload = gr.Textbox(elem_id="ic_resume_payload")
                    resume_trigger = gr.Button("Resume Generate", elem_id="ic_resume_trigger")
                
                html_info = gr.HTML(elem_id="ic_html_info")
                
                apply_btn.click(
                    fn=make_dynamic('api_apply'),
                    inputs=[apply_feather_input],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                resume_trigger.click(
                    fn=wrap_gradio_gpu_call(make_dynamic('api_cont'), extra_outputs=[gr.update(), gr.update(), ""]),
                    _js="function(){ var args = Array.from(arguments); args[0] = window.ic_current_task_id || 'ic_task'; return args; }",
                    inputs=[dummy_component, resume_payload],
                    outputs=[payload_output, prev_btn, now_btn, html_info],
                    show_progress=False
                )
                
                discard_btn.click(
                    fn=make_dynamic('api_discard'),
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                trigger_btn.click(
                    fn=wrap_gradio_gpu_call(make_dynamic('api_generate'), extra_outputs=[gr.update(), gr.update(), ""]),
                    _js="function(){ var args = Array.from(arguments); args[0] = window.ic_current_task_id || 'ic_task'; return args; }",
                    inputs=[dummy_component, payload_input, toprow.prompt, toprow.negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill, ic_outpaint_pad, upscaler_name_input, ic_auto_scale, downscale_algo_input, ic_compile_preset],
                    outputs=[payload_output, prev_btn, now_btn, html_info],
                    show_progress=False 
                ).success(
                    fn=make_dynamic('api_get_workflow'),
                    inputs=[],
                    outputs=[payload_output]
                )
                
                    
                reset_btn_ui.click(
                    fn=None,
                    _js="function(){ if(confirm(t('Are you sure you want to completely reset the canvas? This cannot be undone.'))) { let b = document.getElementById('ic_reset_btn_hidden'); if(b && b.tagName !== 'BUTTON') b = b.querySelector('button') || b; b.click(); } return []; }",
                    inputs=[],
                    outputs=[]
                )
                
                reset_btn.click(
                    fn=make_dynamic('reset_canvas'),
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                    
                prev_btn.click(
                    fn=lambda: make_dynamic('toggle_state')('prev'),
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                now_btn.click(
                    fn=lambda: make_dynamic('toggle_state')('now'),
                    inputs=[],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                
                upload_image.change(
                    fn=make_dynamic('handle_upload'),
                    inputs=[upload_image],
                    outputs=[payload_output, prev_btn, now_btn]
                )
                

                def api_hot_reload():
                    import importlib
                    import sys
                    import scripts.core_logic
                    import scripts.node_manager
                    print("\n[Infinite Canvas] Hot Reloading Extension Logic...")
                    if 'scripts.canvas_state' in sys.modules:
                        importlib.reload(sys.modules['scripts.canvas_state'])
                        print("[Infinite Canvas] -> Reloaded scripts.canvas_state")
                    if 'scripts.core_logic' in sys.modules:
                        importlib.reload(sys.modules['scripts.core_logic'])
                        print("[Infinite Canvas] -> Reloaded scripts.core_logic")
                    if 'scripts.node_manager' in sys.modules:
                        importlib.reload(sys.modules['scripts.node_manager'])
                        print("[Infinite Canvas] -> Reloaded scripts.node_manager")
                    if 'scripts.infinite_canvas' in sys.modules:
                        importlib.reload(sys.modules['scripts.infinite_canvas'])
                        print("[Infinite Canvas] -> Reloaded scripts.infinite_canvas")
                    print("[Infinite Canvas] Hot Reload Complete!\n")
                    return "Backend modules hot reloaded!"
                    
                ic_hot_reload_btn.click(
                    fn=api_hot_reload,
                    inputs=[],
                    outputs=[html_info]
                )
                
                ic_rebuild_js_btn.click(
                    fn=make_dynamic('build_js'),
                    inputs=[],
                    outputs=[html_info]
                )
                


                ic_get_projects_btn.click(
                    fn=make_dynamic('api_list_projects_json'),
                    inputs=[],
                    outputs=[ic_projects_json_output]
                )
                
                # Hidden button to trigger python save
                ic_save_project_hidden_btn = gr.Button("Save Project Hidden", elem_id="ic_save_project_hidden_btn", visible=False)
                
                ic_save_project_hidden_btn.click(
                    fn=make_dynamic('api_save_project'),
                    inputs=[payload_input, toprow.prompt, toprow.negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill, ic_outpaint_pad, upscaler_name_input, downscale_algo_input, ic_project_name_input, ic_auto_scale],
                    outputs=[dummy_component]
                ).success(
                    fn=make_dynamic('api_list_projects_json'),
                    inputs=[],
                    outputs=[ic_projects_json_output]
                ).success(
                    fn=None,
                    js="() => { if(window.icShowCustomToast) { window.icShowCustomToast('Project saved successfully!', 3000, 'white', 'ic-save-toast'); let t = document.getElementById('ic-save-toast'); if(t){ t.querySelector('.ic-toast-bar').parentNode.style.display = 'none'; t.children[0].style.marginBottom = '0'; } } }",
                    inputs=[],
                    outputs=[]
                )
                
                ic_load_project_hidden_btn.click(
                    fn=lambda: gr.update(value=''), # Clear #ic_output to ensure new payload is detected
                    inputs=None,
                    outputs=[payload_output],
                    js="() => { if(window.icShowCustomToast) window.icShowCustomToast('Loading project...', 0, 'white', 'ic-load-toast'); return []; }"
                ).then(
                    fn=make_dynamic('api_load_project'),
                    inputs=[ic_project_name_input, ic_recover_autosave_input],
                    outputs=[payload_output, prev_btn, now_btn, toprow.prompt, toprow.negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill, ic_outpaint_pad, upscaler_name_input, downscale_algo_input, ic_auto_scale, dummy_component]
                ).success(
                    fn=make_dynamic('api_get_workflow'),
                    inputs=[],
                    outputs=[payload_output]
                )
                
                ic_check_autosave_hidden_btn.click(
                    fn=make_dynamic('api_check_project_autosave'),
                    inputs=[ic_project_name_input],
                    outputs=[ic_check_autosave_output]
                )
                
                ic_import_file.change(
                    fn=lambda: gr.update(value=''),
                    inputs=None,
                    outputs=[payload_output],
                    js="() => { if(window.icShowCustomToast) window.icShowCustomToast('Loading project...', 0, 'white', 'ic-load-toast'); return []; }"
                ).then(
                    fn=make_dynamic('api_import_project'),
                    inputs=[ic_import_file],
                    outputs=[payload_output, prev_btn, now_btn, toprow.prompt, toprow.negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill, ic_outpaint_pad, upscaler_name_input, downscale_algo_input, ic_auto_scale, dummy_component, ic_import_file]
                ).success(
                    fn=make_dynamic('api_get_workflow'),
                    inputs=[],
                    outputs=[payload_output]
                )
                
                ic_autosave_enable.change(
                    fn=make_dynamic('api_set_autosave'),
                    inputs=[ic_autosave_enable],
                    outputs=None
                )
                
                ic_check_autosave_btn.click(
                    fn=make_dynamic('api_check_autosave'),
                    inputs=None,
                    outputs=[ic_autosave_status_box]
                )
                
                    
                sam_predict_btn.click(
                    fn=make_dynamic('api_sam_predict'),
                    inputs=[sam_payload_input],
                    outputs=[payload_output],
                )
                
                query_workflow_btn.click(
                    fn=make_dynamic('api_get_workflow'),
                    inputs=[],
                    outputs=[payload_output]
                )
                
                update_workflow_btn.click(
                    fn=make_dynamic('api_update_workflow'),
                    inputs=[update_workflow_payload],
                    outputs=[payload_output]
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
