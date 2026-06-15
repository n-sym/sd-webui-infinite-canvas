import json
import base64
from io import BytesIO
from typing import Any, Dict
from scripts.pipeline_types import GenerationStep, GenerationCtx

def image_to_base64(img):
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

class FirstPassReviewStep(GenerationStep):
    id = "firstpass_review"
    name = "FirstPass Review"
    is_plugin = True
    sort_index = 101

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": ["GeneratedImage"], "out": ["GeneratedImage"]}
    
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
            
        if not ctx.result_img:
            return ctx
            
        img_b64 = image_to_base64(ctx.result_img)
            
        html_content = f"""
        <div style="margin-bottom:15px; text-align: center;">
            <label style="display:block; font-weight:bold; margin-bottom:12px; color:var(--body-text-color, #fff); opacity:0.9; font-size: 1.1em;">First Pass Result</label>
            <img src="{img_b64}" style="display: block; margin: 0 auto; max-width: 100%; max-height: 512px; border-radius: 12px; border: 1px solid var(--border-color-primary, rgba(255,255,255,0.2)); object-fit: contain; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top: 24px;">
            <button id="ic_dyn_cancel_fp" style="padding:0 20px; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:40px; background:var(--button-secondary-background-fill, rgba(255,255,255,0.1)); color:var(--button-secondary-text-color, var(--body-text-color, #fff)); border:1px solid var(--border-color-primary, rgba(255,255,255,0.2)); border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.2s;">Cancel Generation</button>
            <button id="ic_dyn_continue_fp" style="padding:0 24px; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; height:40px; background:var(--color-accent, #f97316); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; transition:all 0.2s; box-shadow:0 2px 8px rgba(249, 115, 22, 0.3);">Continue</button>
        </div>
        """
        
        js_code = """
        const btnCancel = modal.querySelector('#ic_dyn_cancel_fp');
        const btnContinue = modal.querySelector('#ic_dyn_continue_fp');
        
        btnCancel.addEventListener('click', () => {
            window.ic_continue_generation(session_id, { action: 'cancel' });
            modal.style.display = 'none';
        });
        
        btnContinue.addEventListener('click', () => {
            window.ic_continue_generation(session_id, { action: 'continue' });
            modal.style.display = 'none';
        });
        """
        
        import scripts.core_logic as core_logic
        ctx.resume_sort_index = self.sort_index
        return core_logic.pause_generation_and_show_dynamic_dialog(ctx, "FirstPass Review", html_content, js_code)
