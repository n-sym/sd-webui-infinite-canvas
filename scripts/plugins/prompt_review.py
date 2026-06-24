import json
from typing import Any, Dict
from scripts.pipeline_types import GenerationStep, GenerationCtx
from scripts.typing_system import *

class PromptReviewStep(GenerationStep):
    id = "prompt_review"
    name = "Manual Prompt Review"
    is_plugin = True
    sort_index = 19

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": [Prompt], "out": [Prompt]}
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "type": "bool", "label": "Enable", "default": False, "is_generation_param": False}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return {"enabled": bool(raw_params.get("enabled", False))}

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:

        if not ctx.var.get("enabled", False):
            return ctx
            
        prompt = ctx.get(Prompt) or ""
        negative_prompt = ctx.get(NegativePrompt) or ""
            
        html_content = f"""
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px; color:var(--body-text-color, #fff); opacity:0.9;">Positive Prompt</label>
            <textarea id="ic_dyn_prompt" rows="4" style="width:100%; box-sizing:border-box; padding:12px; border-radius:8px; background:var(--input-background-fill, rgba(0,0,0,0.1)); color:var(--body-text-color, #fff); border:1px solid var(--border-color-primary, rgba(255,255,255,0.2)); outline:none; font-family:inherit; resize:vertical; transition:border 0.2s;">{prompt}</textarea>
        </div>
        <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px; color:var(--body-text-color, #fff); opacity:0.9;">Negative Prompt</label>
            <textarea id="ic_dyn_negative" rows="3" style="width:100%; box-sizing:border-box; padding:12px; border-radius:8px; background:var(--input-background-fill, rgba(0,0,0,0.1)); color:var(--body-text-color, #fff); border:1px solid var(--border-color-primary, rgba(255,255,255,0.2)); outline:none; font-family:inherit; resize:vertical; transition:border 0.2s;">{negative_prompt}</textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button id="ic_dyn_cancel" class="res-preset-btn" style="height:40px; padding:0 20px; font-size:15px;">Cancel Generation</button>
            <button id="ic_dyn_continue" class="res-preset-btn primary" style="height:40px; padding:0 24px; font-size:15px;">Continue</button>
        </div>
        """
        
        js_code = """
        const btnCancel = modal.querySelector('#ic_dyn_cancel');
        const btnContinue = modal.querySelector('#ic_dyn_continue');
        const txtPrompt = modal.querySelector('#ic_dyn_prompt');
        const txtNegative = modal.querySelector('#ic_dyn_negative');
        
        btnCancel.addEventListener('click', () => {
            window.ic_continue_generation(session_id, { action: 'cancel' });
            modal.style.display = 'none';
        });
        
        btnContinue.addEventListener('click', () => {
            window.ic_continue_generation(session_id, { 
                action: 'continue', 
                prompt: txtPrompt.value, 
                negative_prompt: txtNegative.value 
            });
            modal.style.display = 'none';
        });
        """
        
        import scripts.core_logic as core_logic
        ctx.resume_sort_index = self.sort_index
        return core_logic.pause_generation_and_show_dynamic_dialog(ctx, "Review Generation Prompt", html_content, js_code)
