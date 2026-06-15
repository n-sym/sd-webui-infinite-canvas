import json
import hashlib
from collections import OrderedDict
from typing import Any, Dict
from scripts.pipeline_types import GenerationStep, GenerationCtx

_llm_cache = OrderedDict()
_LLM_CACHE_SIZE = 100

class LLMPromptOptimizeStep(GenerationStep):
    id = "llm_prompt_optimizer"
    name = "LLM Prompt Optimizer"
    is_plugin = True
    sort_index = 15

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": ["Prompt"], "out": ["Prompt"]}
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "type": "bool", "label": "Enable", "default": False, "is_generation_param": False},
            {"name": "enable_cache", "type": "bool", "label": "Enable LRU Cache", "default": True, "is_generation_param": False},
            {"name": "api_url", "type": "string", "label": "API URL", "default": "https://api.deepseek.com/chat/completions", "is_generation_param": False},
            {"name": "api_key", "type": "password", "label": "API Key", "default": "", "is_generation_param": False},
            {"name": "model", "type": "string", "label": "Model Name", "default": "deepseek-v4-flash", "is_generation_param": False},
            {"name": "detail_richness", "type": "float", "label": "Detail Richness", "default": 0.5, "min": 0.0, "max": 1.0, "step": 0.1},
            {"name": "prompt_fidelity", "type": "float", "label": "Prompt Fidelity", "default": 0.5, "min": 0.0, "max": 1.0, "step": 0.1},
            {"name": "nl_style", "type": "enum", "label": "Language Style", "choices": ["Mixed", "Pure Natural Language", "Pure Tag Style"], "default": "Mixed"},
            {"name": "prefix_tags", "type": "text", "label": "Prefix Tags", "default": "safe, year 2025, newest, masterpiece, best quality, score_9, score_8"},
            {"name": "character_tags", "type": "text", "label": "Character & Series", "default": ""},
            {"name": "style_tags", "type": "text", "label": "Artist & Style", "default": ""}
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        def _get(k, default):
            v = raw_params.get(k)
            return default if v is None else v
        return {
            "enabled": bool(_get("enabled", False)),
            "enable_cache": bool(_get("enable_cache", True)),
            "api_url": str(_get("api_url", "https://api.deepseek.com/chat/completions")),
            "api_key": str(_get("api_key", "")),
            "model": str(_get("model", "deepseek-v4-flash")),
            "detail_richness": float(_get("detail_richness", 0.5)),
            "prompt_fidelity": float(_get("prompt_fidelity", 0.5)),
            "nl_style": str(_get("nl_style", "Mixed")),
            "prefix_tags": str(_get("prefix_tags", "safe, year 2025, newest, masterpiece, best quality, score_9, score_8")),
            "character_tags": str(_get("character_tags", "")),
            "style_tags": str(_get("style_tags", ""))
        }
        
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        is_enabled = ctx.var.get("enabled", False)
        if not is_enabled or not ctx.prompt:
            return ctx
            
        import re
        import requests
        
        # Extract and remove LoRAs
        loras = re.findall(r'<lora:[^>]+>', ctx.prompt)
        content_prompt = re.sub(r'<lora:[^>]+>', '', ctx.prompt).strip()
        
        # Optimize content
        api_url = ctx.var.get("api_url", "")
        api_key = ctx.var.get("api_key", "")
        model = ctx.var.get("model", "")
        optimized_content = content_prompt
        
        if api_key and content_prompt:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            char_tags = ctx.var.get("character_tags", "")
            style_tags = ctx.var.get("style_tags", "")
            
            detail_richness = ctx.var.get("detail_richness", 0.5)
            prompt_fidelity = ctx.var.get("prompt_fidelity", 0.5)
            nl_style = ctx.var.get("nl_style", "Mixed")

            if nl_style == "Pure Natural Language":
                style_instruction = "Enhance the user's text into a highly detailed natural language description. Use coherent sentences and paragraphs. Reply ONLY with the description."
            elif nl_style == "Pure Tag Style":
                style_instruction = "Enhance the user's text into a comma-separated list of highly detailed stable diffusion tags. Reply ONLY with the tags."
            else:
                style_instruction = "Enhance the user's text into a highly detailed prompt. You can use a mix of natural language sentences and comma-separated tags. Reply ONLY with the enhanced prompt."

            richness_instruction = f"Detail Richness Control: {detail_richness} (0.0 means keep it very concise and close to original length, 1.0 means aggressively expand with highly intricate visual details, lighting, atmosphere, and composition)."
            fidelity_instruction = f"Prompt Fidelity Control: {prompt_fidelity} (1.0 means strictly preserve the user's original phrasing and intent without deviation, 0.0 means you have full creative freedom to rewrite and reimagine the prompt)."

            system_prompt = f"""{style_instruction}

{richness_instruction}
{fidelity_instruction}

CRITICAL RULES:
1. DO NOT add any quality tags (e.g., masterpiece, best quality, highres).
2. DO NOT add "close-up" unless the user explicitly asks for it.
3. The following character and style tags will be automatically combined with your output. DO NOT copy or include them in your output, just use them as context for your generation:
[Context - Characters]: {char_tags if char_tags else 'None'}
[Context - Style]: {style_tags if style_tags else 'None'}
"""
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": content_prompt}
                ]
            }
            
            enable_cache = ctx.var.get("enable_cache", True)
            payload_str = json.dumps(payload, sort_keys=True)
            cache_key = hashlib.md5(payload_str.encode('utf-8')).hexdigest()
            
            if enable_cache and cache_key in _llm_cache:
                optimized_content = _llm_cache[cache_key]
                _llm_cache.move_to_end(cache_key)
                print(f"[LLM Optimizer] Cache hit for: {content_prompt}")
            else:
                try:
                    print(f"[LLM Optimizer] Sending to LLM: {content_prompt}")
                    response = requests.post(api_url, headers=headers, json=payload, timeout=15)
                    response.raise_for_status()
                    optimized_content = response.json()['choices'][0]['message']['content'].strip()
                    print(f"[LLM Optimizer] Received optimized: {optimized_content}")
                    
                    if enable_cache:
                        _llm_cache[cache_key] = optimized_content
                        if len(_llm_cache) > _LLM_CACHE_SIZE:
                            _llm_cache.popitem(last=False)
                except Exception as e:
                    print(f"[LLM Optimizer] Failed to optimize: {e}")
        
        # Reconstruct final prompt
        parts = []
        for p in [ctx.var.get("prefix_tags", ""), ctx.var.get("character_tags", ""), ctx.var.get("style_tags", ""), optimized_content]:
            p = p.strip()
            if p:
                parts.append(p)
                
        final_prompt = ", ".join(parts)
        if loras:
            final_prompt += " " + " ".join(loras)
            
        ctx.prompt = final_prompt
        return ctx
