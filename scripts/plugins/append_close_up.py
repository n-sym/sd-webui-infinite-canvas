from typing import Any, Dict
from scripts.pipeline_types import GenerationStep, GenerationCtx
from scripts.typing_system import *

class AppendCloseUpStep(GenerationStep):
    id = "append_close_up"
    name = "Append Close-Up"
    is_plugin = True
    sort_index = 18

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
        return {
            "enabled": bool(raw_params.get("enabled", False))
        }
        
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        is_enabled = ctx.var.get("enabled", False)
        prompt = ctx.get(Prompt)
        if is_enabled and prompt:
            prompt = prompt.rstrip()
            if not prompt.endswith(","):
                prompt += ","
            prompt += " close-up"
            ctx.set(Prompt, prompt)
            print(f"[Append Close-Up] Appended to prompt: {prompt}")
        return ctx
