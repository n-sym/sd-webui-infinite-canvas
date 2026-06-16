import json
import traceback
import gradio as gr
from modules import shared
from scripts.canvas_state import canvas_state
from scripts.pipeline_types import GenerationCtx, GenerationStep, SamplerConfigData, ResolutionData, CanvasConfigData
from scripts.typing_system import *

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
from scripts.plugins.sd_controlnet import SdControlNetStep
from scripts.plugins.firstpass_review import FirstPassReviewStep
from scripts.plugins.second_pass import SecondPassStep
from scripts.plugins.edge_fix import EdgeFixStep

import scripts.plugins.prompt_review as prompt_review

def validate_pipeline(pipeline, step_params):
    from scripts.pipeline_types import match_type, get_type_name
    available_types = [SdStyleInput]
    type_error_step_index = -1
    type_error_reason = ""
    
    active_steps = []
    for i, step in enumerate(pipeline):
        if step.is_plugin:
            if not step_params.get(step.id, {}).get("enabled", False):
                continue
        active_steps.append((i, step))
                
    for i, step in active_steps:
        sig = getattr(step.__class__, 'type_signature', lambda: {"in": [], "out": []})()
        if callable(sig):
            sig = sig()
            
        ins = sig.get("in", [])
        for t in ins:
            matched = False
            for avail_t in available_types:
                if match_type(avail_t, t):
                    matched = True
                    break
            
            if not matched:
                type_error_step_index = i
                type_error_reason = f"Requires input '{get_type_name(t)}', but it is not provided by any upstream step."
                break
                
        if type_error_step_index != -1:
            break
            
        outs = sig.get("out", [])
        for t in outs:
            available_types.append(t)
            
    if type_error_step_index == -1:
        has_final = False
        for avail_t in available_types:
            if match_type(avail_t, FinalOutputImage):
                has_final = True
                break
        if not has_final:
            if active_steps:
                last_idx, _ = active_steps[-1]
                type_error_step_index = last_idx
                type_error_reason = "Pipeline does not output 'FinalOutputImage' at the end."
            
    return type_error_step_index, type_error_reason

def execute_pipeline_core(ctx: GenerationCtx):
    pipeline = [
        ParseInputStep(),
        PrepareCanvasStep(),
        LLMPromptOptimizeStep(),
        AppendCloseUpStep(),
        PromptReviewStep(),
        SetupProcessingStep(),
        LatentBlendStep(),
        SdControlNetStep(),
        FirstPassStep(),
        FirstPassReviewStep(),
        SecondPassStep(),
        EdgeFixStep(),
        FinalizeStateStep()
    ]
    pipeline.sort(key=lambda x: getattr(x, 'sort_index', 0))
    
    # 1. Validation Phase
    err_idx, err_reason = validate_pipeline(pipeline, ctx.step_params)
    if err_idx != -1:
        ctx.set(Error, f"Pipeline Type Error at '{pipeline[err_idx].name}': {err_reason}")
        return
    
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
                sc = ctx.get(SamplerConfig)
                res = ctx.get(Resolution)
                if not sc or not res:
                    total_steps += 20
                else:
                    total_steps += sc.steps
                    if ctx.step_params.get("edge_fix", {}).get("enabled", False):
                        power = ctx.step_params.get("edge_fix", {}).get("power", 1.0)
                        total_steps += max(1, int(sc.steps * 0.2 * power))
                        
                    if ctx.step_params.get("second_pass", {}).get("enabled", False):
                        import math
                        sp = ctx.step_params["second_pass"]
                        scale_factor = sp.get("scale_factor", 1.5)
                        overlap = sp.get("overlap", 64)
                        upscale_steps = sp.get("steps", 15)
                        
                        upscaled_w = int(res.gen_width * scale_factor)
                        upscaled_h = int(res.gen_height * scale_factor)
                        
                        # Compute tiles based on split_grid logic
                        if upscaled_w > res.gen_width or upscaled_h > res.gen_height:
                            non_overlap_w = res.gen_width - overlap
                            non_overlap_h = res.gen_height - overlap
                            cols = math.ceil((upscaled_w - overlap) / non_overlap_w) if non_overlap_w > 0 else 1
                            rows = math.ceil((upscaled_h - overlap) / non_overlap_h) if non_overlap_h > 0 else 1
                            cols = max(1, cols)
                            rows = max(1, rows)
                            num_tiles = cols * rows
                        else:
                            num_tiles = 1
                            
                        total_steps += num_tiles * upscale_steps
                    
            if step.id == "edge_fix" or step.id == "second_pass":
                sc = ctx.get(SamplerConfig)
                res = ctx.get(Resolution)
                steps_accumulated += sc.steps if sc else 20
                if step.id == "edge_fix" and ctx.step_params.get("second_pass", {}).get("enabled", False) and res:
                    # add second pass tiles steps to accumulated
                    sp = ctx.step_params["second_pass"]
                    scale_factor = sp.get("scale_factor", 1.5)
                    overlap = sp.get("overlap", 64)
                    upscale_steps = sp.get("steps", 15)
                    upscaled_w = int(res.gen_width * scale_factor)
                    upscaled_h = int(res.gen_height * scale_factor)
                    import math
                    non_overlap_w = res.gen_width - overlap
                    non_overlap_h = res.gen_height - overlap
                    cols = math.ceil((upscaled_w - overlap) / non_overlap_w) if non_overlap_w > 0 else 1
                    rows = math.ceil((upscaled_h - overlap) / non_overlap_h) if non_overlap_h > 0 else 1
                    num_tiles = max(1, cols) * max(1, rows)
                    steps_accumulated += (num_tiles * upscale_steps) - (sc.steps if sc else 20) # replace ctx.steps with tile total
            
            # Update WebUI progress text
            hue = getattr(step, 'sort_index', 0) % 360
            shared.state.textinfo = f"{getattr(step, 'name', step.id)}|{hue}|{total_steps}|{steps_accumulated}"
            
            # Force an immediate progress broadcast so instantaneous steps appear in the UI
            try:
                from scripts.ic_server.api_routes import manager, _build_progress_payload
                manager.broadcast_from_thread(_build_progress_payload())
            except Exception:
                pass
            
            # Check if we should actually execute this step during a resume
            if getattr(ctx, "is_resuming", False) and getattr(step, 'sort_index', 0) <= getattr(ctx, "resume_sort_index", 18):
                continue
                
            ctx = step(ctx)
            if ctx.has_error() or ctx.get(SoftStop) or ctx.get(FinalPayload):
                break
    except Exception as e:
        traceback.print_exc()
        ctx.set(Error, str(e))
        
    if ctx.has_error():
        return {"error": ctx.get(Error)}
        
    if getattr(shared.state, 'interrupted', False) or getattr(shared.state, 'skipped', False):
        return {"type": "generation_done", "tiles": []}
        
    final_payload = ctx.get(FinalPayload)
    if final_payload:
        try:
            return json.loads(final_payload)
        except json.JSONDecodeError:
            return {"type": "payload", "content": final_payload}
            
    return {}

def api_generate(id_task, payload_json):
    # All generation scalars (prompt, steps, cfg, sampler, seed, ...) are now
    # declared as ParseInputStep params and travel inside payload_json's
    # step_params['parse_input']. ParseInputStep.__call__ resolves them and
    # writes them back onto ctx — so api_generate itself only needs the two
    # positional inputs.
    ctx = GenerationCtx(id_task=id_task, payload_json=payload_json)
    return execute_pipeline_core(ctx)

def api_cont(id_task, payload_json):
    try:
        data = json.loads(payload_json)
        session_id = data.get("session_id")
        action = data.get("action")
        
        import scripts.core_logic
        if session_id not in scripts.core_logic.pending_sessions:
            return {"error": "Session expired."}
            
        ctx = scripts.core_logic.pending_sessions.pop(session_id)
        
        if action == "cancel":
            return {"type": "generation_done", "tiles": []}
            
        ctx.set(Prompt, data.get("prompt", ctx.get(Prompt)))
        ctx.set(NegativePrompt, data.get("negative_prompt", ctx.get(NegativePrompt)))
        ctx.dynamic_dialog_result = data
        ctx.is_resuming = True
        ctx.clear(FinalPayload)
        ctx.clear(Error)
        
        return execute_pipeline_core(ctx)
    except Exception as e:
        traceback.print_exc()
        return []

def api_validate_workflow(payload_json):
    try:
        data = json.loads(payload_json)
        step_params = data.get("step_params", {})
        
        pipeline = [
            ParseInputStep(),
            PrepareCanvasStep(),
            LLMPromptOptimizeStep(),
            AppendCloseUpStep(),
            PromptReviewStep(),
            SetupProcessingStep(),
            LatentBlendStep(),
            SdControlNetStep(),
            FirstPassStep(),
            FirstPassReviewStep(),
            SecondPassStep(),
            EdgeFixStep(),
            FinalizeStateStep()
        ]
        pipeline.sort(key=lambda x: getattr(x, 'sort_index', 0))
        
        err_idx, err_reason = validate_pipeline(pipeline, step_params)
        failed_step_id = pipeline[err_idx].id if err_idx != -1 else None
        
        return {
            "valid": err_idx == -1,
            "failed_step_id": failed_step_id,
            "error_reason": err_reason
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

def api_get_workflow():
    pipeline_template = [
        ParseInputStep,
        PrepareCanvasStep,
        LLMPromptOptimizeStep,
        AppendCloseUpStep,
        PromptReviewStep,
        SetupProcessingStep,
        LatentBlendStep,
        SdControlNetStep,
        FirstPassStep,
        FirstPassReviewStep,
        SecondPassStep,
        EdgeFixStep,
        FinalizeStateStep
    ]
    
    registry = []
    for cls in pipeline_template:
        raw_sig = getattr(cls, 'type_signature', lambda: {"in": [], "out": []})()
        serialized_sig = {
            "in": [t.to_json() if hasattr(t, 'to_json') else t for t in raw_sig.get("in", [])],
            "out": [t.to_json() if hasattr(t, 'to_json') else t for t in raw_sig.get("out", [])]
        }
        
        registry.append({
            "id": cls.id,
            "name": getattr(cls, 'name', cls.__name__),
            "is_plugin": getattr(cls, 'is_plugin', False),
            "sort_index": getattr(cls, 'sort_index', 500),
            "type_signature": serialized_sig,
            "params": cls.get_params(pipeline_template) if 'pipeline' in cls.get_params.__code__.co_varnames else cls.get_params()
        })
        
    return {
        "type": "workflow_query",
        "workflow": canvas_state.workflow,
        "step_params": canvas_state.step_params,
        "registry": registry
    }

def api_update_workflow(payload_json):
    if payload_json:
        try:
            data = json.loads(payload_json)
            payload_step_params = data.get("step_params", {})

            # ParseInputStep is a CORE step (is_plugin=False), so it isn't
            # covered by the plugin loop below — resolve it explicitly. Without
            # this, raw values from the UI (e.g. enum string labels for
            # inpainting_fill, float strings from number inputs) get stored
            # verbatim and then echoed back by api_get_workflow, immediately
            # reverting the user's edit.
            if 'parse_input' in payload_step_params:
                resolved = ParseInputStep.resolve_params(payload_step_params['parse_input'])
                if 'parse_input' not in canvas_state.step_params:
                    canvas_state.step_params['parse_input'] = {}
                canvas_state.step_params['parse_input'].update(resolved)

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
