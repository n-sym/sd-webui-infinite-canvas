import json
from typing import Any, Dict
from scripts.pipeline_types import GenerationStep, GenerationCtx

class PromptReviewStep(GenerationStep):
    id = "prompt_review"
    name = "Manual Prompt Review"
    is_plugin = True
    sort_index = 19
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "type": "bool", "label": "Enable", "default": False}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return {"enabled": bool(raw_params.get("enabled", False))}

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:

        if not ctx.var.get("enabled", False):
            return ctx
            
        html_content = f"""
        <div style="margin-bottom:15px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px; color:var(--body-text-color, #fff); opacity:0.9;">Positive Prompt</label>
            <textarea id="ic_dyn_prompt" rows="4" style="width:100%; box-sizing:border-box; padding:12px; border-radius:8px; background:var(--input-background-fill, rgba(0,0,0,0.1)); color:var(--body-text-color, #fff); border:1px solid var(--border-color-primary, rgba(255,255,255,0.2)); outline:none; font-family:inherit; resize:vertical; transition:border 0.2s;">{ctx.prompt}</textarea>
        </div>
        <div style="margin-bottom:24px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px; color:var(--body-text-color, #fff); opacity:0.9;">Negative Prompt</label>
            <textarea id="ic_dyn_negative" rows="3" style="width:100%; box-sizing:border-box; padding:12px; border-radius:8px; background:var(--input-background-fill, rgba(0,0,0,0.1)); color:var(--body-text-color, #fff); border:1px solid var(--border-color-primary, rgba(255,255,255,0.2)); outline:none; font-family:inherit; resize:vertical; transition:border 0.2s;">{ctx.negative_prompt}</textarea>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button id="ic_dyn_cancel" style="padding:0 20px; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:40px; background:var(--button-secondary-background-fill, rgba(255,255,255,0.1)); color:var(--button-secondary-text-color, var(--body-text-color, #fff)); border:1px solid var(--border-color-primary, rgba(255,255,255,0.2)); border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.2s;">Cancel Generation</button>
            <button id="ic_dyn_continue" style="padding:0 24px; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:40px; background:var(--color-accent, #f97316); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.2s; box-shadow:0 2px 8px rgba(249, 115, 22, 0.3);">Continue</button>
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
