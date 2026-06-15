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
import scripts.ic_server.api_routes

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
                html_info = gr.HTML(elem_id="ic_html_info")
                
    return [(infinite_canvas_interface, "Infinite Canvas", "infinite_canvas")]

script_callbacks.on_ui_tabs(on_ui_tabs)
