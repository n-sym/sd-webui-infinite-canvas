import json
import traceback
import gradio as gr
from modules import shared
from scripts.canvas_state import canvas_state
from scripts.pipeline_types import GenerationCtx, GenerationStep

from scripts.core_logic import (
    ParseInputStep,
    PrepareCanvasStep,
    SetupProcessingStep,
    FirstPassStep,
    FinalizeStateStep
)

from scripts.plugins.llm_prompt_optimize import LLMPromptOptimizeStep
from scripts.plugins.append_close_up import AppendCloseUpStep
from scripts.plugins.prompt_review import PromptReviewStep
from scripts.plugins.latent_blend import LatentBlendStep
from scripts.plugins.firstpass_review import FirstPassReviewStep
from scripts.plugins.second_pass import SecondPassStep
from scripts.plugins.edge_fix import EdgeFixStep

import scripts.plugins.prompt_review as prompt_review

def execute_pipeline_core(ctx: GenerationCtx):
    pipeline = [
        ParseInputStep(),
        PrepareCanvasStep(),
        LLMPromptOptimizeStep(),
        AppendCloseUpStep(),
        PromptReviewStep(),
        SetupProcessingStep(),
        LatentBlendStep(),
        FirstPassStep(),
        FirstPassReviewStep(),
        SecondPassStep(),
        EdgeFixStep(),
        FinalizeStateStep()
    ]
    pipeline.sort(key=lambda x: getattr(x, 'sort_index', 0))
    
    try:
        total_steps = 0
        steps_accumulated = 0
        
        for step in pipeline:
            if getattr(ctx, "is_resuming", False) and getattr(step, 'sort_index', 0) <= 18:
                continue
                
            if step.id not in ctx.step_params:
                ctx.step_params[step.id] = {}
            ctx.var = ctx.step_params[step.id]
            
            # Update total steps once params are populated
            if step.id == "setup_processing":
                total_steps += ctx.steps
                if ctx.step_params.get("edge_fix", {}).get("enabled", False):
                    power = ctx.step_params.get("edge_fix", {}).get("power", 1.0)
                    total_steps += max(1, int(ctx.steps * 0.2 * power))
                    
                if ctx.step_params.get("second_pass", {}).get("enabled", False):
                    import math
                    sp = ctx.step_params["second_pass"]
                    scale_factor = sp.get("scale_factor", 1.5)
                    overlap = sp.get("overlap", 64)
                    upscale_steps = sp.get("steps", 15)
                    
                    upscaled_w = int(ctx.gen_width * scale_factor)
                    upscaled_h = int(ctx.gen_height * scale_factor)
                    
                    # Compute tiles based on split_grid logic
                    if upscaled_w > ctx.gen_width or upscaled_h > ctx.gen_height:
                        non_overlap_w = ctx.gen_width - overlap
                        non_overlap_h = ctx.gen_height - overlap
                        cols = math.ceil((upscaled_w - overlap) / non_overlap_w) if non_overlap_w > 0 else 1
                        rows = math.ceil((upscaled_h - overlap) / non_overlap_h) if non_overlap_h > 0 else 1
                        cols = max(1, cols)
                        rows = max(1, rows)
                        num_tiles = cols * rows
                    else:
                        num_tiles = 1
                        
                    total_steps += num_tiles * upscale_steps
                    
            if step.id == "edge_fix" or step.id == "second_pass":
                steps_accumulated += ctx.steps
                if step.id == "edge_fix" and ctx.step_params.get("second_pass", {}).get("enabled", False):
                    # add second pass tiles steps to accumulated
                    sp = ctx.step_params["second_pass"]
                    scale_factor = sp.get("scale_factor", 1.5)
                    overlap = sp.get("overlap", 64)
                    upscale_steps = sp.get("steps", 15)
                    upscaled_w = int(ctx.gen_width * scale_factor)
                    upscaled_h = int(ctx.gen_height * scale_factor)
                    import math
                    non_overlap_w = ctx.gen_width - overlap
                    non_overlap_h = ctx.gen_height - overlap
                    cols = math.ceil((upscaled_w - overlap) / non_overlap_w) if non_overlap_w > 0 else 1
                    rows = math.ceil((upscaled_h - overlap) / non_overlap_h) if non_overlap_h > 0 else 1
                    num_tiles = max(1, cols) * max(1, rows)
                    steps_accumulated += (num_tiles * upscale_steps) - ctx.steps # replace ctx.steps with tile total
            
            # Update WebUI progress text
            hue = getattr(step, 'sort_index', 0) % 360
            shared.state.textinfo = f"{getattr(step, 'name', step.id)}|{hue}|{total_steps}|{steps_accumulated}"
            
            # Check if we should actually execute this step during a resume
            if getattr(ctx, "is_resuming", False) and getattr(step, 'sort_index', 0) <= getattr(ctx, "resume_sort_index", 18):
                continue
                
            ctx = step(ctx)
            if ctx.is_error or ctx.final_payload != "":
                break
    except Exception as e:
        traceback.print_exc()
        ctx.is_error = True
        ctx.error_message = str(e)
        
    if ctx.is_error and ctx.error_message != "":
        return "", gr.update(), gr.update(), f"Error: {ctx.error_message}"
        
    if getattr(shared.state, 'interrupted', False) or getattr(shared.state, 'skipped', False):
        import json
        payload = {"type": "generation_done", "tiles": []}
        return json.dumps(payload), gr.update(), gr.update(), ""
        
    if ctx.final_payload:
        return ctx.final_payload, gr.update(interactive=canvas_state.can_undo()), gr.update(interactive=canvas_state.can_redo()), ""
        
    return "", gr.update(), gr.update(), ""

def api_generate(id_task, payload_json, prompt, negative_prompt, steps, cfg_scale, shift, denoising_strength, sampler_name, scheduler, gen_width, gen_height, seed, inpainting_fill_idx, outpaint_pad, upscaler_name, auto_scale, downscale_algo, compile_preset="Disable"):
    ctx = GenerationCtx(
        id_task=id_task, payload_json=payload_json, prompt=prompt, negative_prompt=negative_prompt,
        steps=steps, cfg_scale=cfg_scale, shift=shift, denoising_strength=denoising_strength,
        sampler_name=sampler_name, scheduler=scheduler, gen_width=gen_width, gen_height=gen_height,
        seed=seed, inpainting_fill_idx=inpainting_fill_idx, outpaint_pad=outpaint_pad,
        upscaler_name=upscaler_name, auto_scale=auto_scale, downscale_algo=downscale_algo
    )
    ctx.compile_preset = compile_preset
    return execute_pipeline_core(ctx)

def api_cont(id_task, payload_json):
    try:
        data = json.loads(payload_json)
        session_id = data.get("session_id")
        action = data.get("action")
        
        import scripts.core_logic
        if session_id not in scripts.core_logic.pending_sessions:
            return "Session expired."
            
        ctx = scripts.core_logic.pending_sessions.pop(session_id)
        
        if action == "cancel":
            payload = {"type": "generation_done", "tiles": []}
            return json.dumps(payload), gr.update(), gr.update(), ""
            
        ctx.prompt = data.get("prompt", ctx.prompt)
        ctx.negative_prompt = data.get("negative_prompt", ctx.negative_prompt)
        ctx.dynamic_dialog_result = data
        ctx.is_resuming = True
        ctx.final_payload = ""
        ctx.is_error = False
        
        return execute_pipeline_core(ctx)
    except Exception as e:
        traceback.print_exc()
        return f"Error: {str(e)}"

def api_get_workflow():
    import json
    
    pipeline_template = [
        ParseInputStep,
        PrepareCanvasStep,
        LLMPromptOptimizeStep,
        AppendCloseUpStep,
        PromptReviewStep,
        SetupProcessingStep,
        LatentBlendStep,
        FirstPassStep,
        FirstPassReviewStep,
        SecondPassStep,
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
