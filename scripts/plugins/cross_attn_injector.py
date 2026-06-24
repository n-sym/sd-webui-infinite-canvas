# -------------------------------------------------------------------------
# MIT License
# 
# Copyright (c) 2026 An1X3R and 汐浮尘
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
# 
# This file contains code adapted from the Anima-Artist-Mixer project.
# -------------------------------------------------------------------------

import json
import torch
import math
from typing import Any, Dict, List
from collections import OrderedDict
from scripts.pipeline_types import GenerationStep, GenerationCtx
from scripts.typing_system import *
from modules import prompt_parser
from modules import scripts
from backend import attention

class CrossAttnWrapper(torch.nn.Module):
    def __init__(self, original_module, style_embeddings, overall_strength, artist_ema_alpha=0.0, combine_mode="Output Avg"):
        super().__init__()
        self.original = original_module
        self.style_embeddings = style_embeddings
        self.overall_strength = overall_strength
        self.artist_ema_alpha = artist_ema_alpha
        self.combine_mode = combine_mode
        self.ema_cache = None
        self._printed_forward = False

    def forward(self, *args, **kwargs):
        if not self._printed_forward:
            print(f"[Cross Atten Injector] -> Entered forward of {self.original.__class__.__name__}")
        
        # 1. Base out
        base_out = self.original(*args, **kwargs)
        
        # Determine how the context was passed
        context_tensor = None
        context_key = None
        
        for k in ['context', 'encoder_hidden_states']:
            if k in kwargs and kwargs[k] is not None:
                context_tensor = kwargs[k]
                context_key = k
                break
                
        arg_idx = -1
        if context_tensor is None and len(args) > 1:
            context_tensor = args[1]
            arg_idx = 1
            
        if not self._printed_forward:
            print(f"[Cross Atten Injector] -> Context Tensor Found? {context_tensor is not None}. context_key: {context_key}")
            self._printed_forward = True
            
        if not self.style_embeddings or context_tensor is None:
            return base_out
            
        x = args[0]
        
        # Determine CFG Mask (only apply to COND, not UNCOND)
        t_opts = kwargs.get("transformer_options", {})
        cou = t_opts.get("cond_or_uncond", None)
        bsz = x.shape[0]
        
        if cou is not None and len(cou) == bsz:
            # 0 means COND, 1 means UNCOND in Forge/ComfyUI
            mask = [c == 0 for c in cou]
        else:
            mask = [True] * bsz
            
        # If no elements are conditional, just return base
        if not any(mask):
            return base_out
            
        # Extract weights and normalize them
        weights = [style_data["weight"] for style_data in self.style_embeddings]
        total_abs_weight = sum(abs(w) for w in weights)
        if total_abs_weight <= 1e-8:
            norm_weights = [1.0 / len(weights)] * len(weights)
        else:
            norm_weights = [w / total_abs_weight for w in weights]
            
        if self.combine_mode == "Concat":
            parts = []
            for style_data in self.style_embeddings:
                s_cond = style_data["cond"]
                raw_w = style_data["weight"]
                # Extract tensor from various formats
                if isinstance(s_cond, list) and len(s_cond) > 0:
                    if isinstance(s_cond[0], (list, tuple)):
                        s_cond = s_cond[0][0]
                    elif torch.is_tensor(s_cond[0]):
                        s_cond = s_cond[0]
                elif isinstance(s_cond, dict) and "crossattn" in s_cond:
                    s_cond = s_cond["crossattn"]
                
                if torch.is_tensor(s_cond):
                    s_cond = s_cond.to(device=x.device, dtype=x.dtype)
                    if s_cond.shape[0] != x.shape[0]:
                        if x.shape[0] % s_cond.shape[0] == 0:
                            s_cond = s_cond.repeat(x.shape[0] // s_cond.shape[0], 1, 1)
                        else:
                            s_cond = s_cond.expand(x.shape[0], -1, -1)
                    parts.append(s_cond * float(raw_w))
            
            if not parts:
                return base_out
            
            combined_s_cond = torch.cat(parts, dim=1)
            
            if context_key:
                c_kwargs = kwargs.copy()
                c_kwargs[context_key] = combined_s_cond
                combined_style = self.original(*args, **c_kwargs)
            else:
                c_args = list(args)
                c_args[arg_idx] = combined_s_cond
                combined_style = self.original(*c_args, **kwargs)
                
        else:
            style_outs = []
            for style_data in self.style_embeddings:
                s_cond = style_data["cond"]
                
                # Extract tensor from various formats
                if isinstance(s_cond, list) and len(s_cond) > 0:
                    if isinstance(s_cond[0], (list, tuple)):
                        s_cond = s_cond[0][0]
                    elif torch.is_tensor(s_cond[0]):
                        s_cond = s_cond[0]
                elif isinstance(s_cond, dict) and "crossattn" in s_cond:
                    s_cond = s_cond["crossattn"]
                    
                if torch.is_tensor(s_cond):
                    s_cond = s_cond.to(device=x.device, dtype=x.dtype)
                    if s_cond.shape[0] != x.shape[0]:
                        if x.shape[0] % s_cond.shape[0] == 0:
                            s_cond = s_cond.repeat(x.shape[0] // s_cond.shape[0], 1, 1)
                        else:
                            s_cond = s_cond.expand(x.shape[0], -1, -1)
                
                if context_key:
                    c_kwargs = kwargs.copy()
                    c_kwargs[context_key] = s_cond
                    out_i = self.original(*args, **c_kwargs)
                else:
                    c_args = list(args)
                    c_args[arg_idx] = s_cond
                    out_i = self.original(*c_args, **kwargs)
                    
                style_outs.append(out_i)
                
            if not style_outs:
                return base_out
                
            if self.combine_mode == "SVD Lowrank" and len(style_outs) >= 2:
                try:
                    A = torch.stack(style_outs, dim=0).to(torch.float32)
                    base_f32 = base_out.to(torch.float32).unsqueeze(0)
                    delta = A - base_f32
                    
                    N_styles = delta.shape[0]
                    orig_shape = delta.shape
                    D_mat = delta.reshape(N_styles, -1)
                    
                    U, S, V = torch.svd_lowrank(D_mat, q=1, niter=2)
                    D_lowrank = U @ torch.diag(S) @ V.transpose(-1, -2)
                    
                    w_t = torch.tensor(norm_weights, device=D_lowrank.device, dtype=D_lowrank.dtype).view(N_styles, 1)
                    delta_avg = (D_lowrank * w_t).sum(dim=0)
                    delta_avg = delta_avg.reshape(orig_shape[1:]).to(base_out.dtype)
                    
                    combined_style = base_out + delta_avg
                except Exception as e:
                    print(f"[Cross Atten Injector] SVD Lowrank failed: {e}. Falling back to Output Avg.")
                    combined_style = sum(o * w for o, w in zip(style_outs, norm_weights))
            else:
                combined_style = sum(o * w for o, w in zip(style_outs, norm_weights))
            
        # Apply EMA (Exponential Moving Average) across sampling steps
        if self.artist_ema_alpha > 0.0:
            if self.ema_cache is not None and self.ema_cache.shape == combined_style.shape:
                combined_style = self.artist_ema_alpha * self.ema_cache + (1.0 - self.artist_ema_alpha) * combined_style
            self.ema_cache = combined_style.detach()
            
        final_out = base_out.clone()
        for i, hit in enumerate(mask):
            if hit:
                final_out[i] = base_out[i] * (1.0 - self.overall_strength) + combined_style[i] * self.overall_strength
                
        return final_out

class LRUCache:
    def __init__(self, capacity: int):
        self.cache = OrderedDict()
        self.capacity = capacity

    def __contains__(self, key):
        return key in self.cache

    def __getitem__(self, key):
        if key not in self.cache:
            raise KeyError(key)
        self.cache.move_to_end(key)
        return self.cache[key]

    def __setitem__(self, key, value):
        self.cache[key] = value
        self.cache.move_to_end(key)
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)

_STYLE_EMBEDDING_CACHE = LRUCache(capacity=32)

class CrossAttnInjectorPatchScript(scripts.Script):
    def __init__(self, style_prompts_text: str, base_prompt: str, strength: float, combine_mode: str, artist_ema_alpha: float = 0.0):
        super().__init__()
        self.style_prompts_text = style_prompts_text
        self.base_prompt = base_prompt.strip()
        self.overall_strength = strength
        self.combine_mode = combine_mode
        self.artist_ema_alpha = artist_ema_alpha
        self.style_chunks = []
        self.style_embeddings = []
        self.wrapped_modules = []
        
    def title(self):
        return "Cross Atten CLIP-Style Prompt Injector"

    def show(self, is_img2img):
        return scripts.AlwaysVisible

    def process(self, p, *args, **kwargs):
        if not self.style_prompts_text.strip():
            return
            
        # Parse the style prompts using A1111's parser
        parsed = prompt_parser.parse_prompt_attention(self.style_prompts_text)
        self.style_chunks = parsed  # List of (text, weight)
        
        print(f"[Cross Atten Injector] Parsed {len(self.style_chunks)} style chunks: {self.style_chunks}")
        
        # Get independent embeddings for each style chunk
        if hasattr(p.sd_model, 'get_learned_conditioning'):
            model_id = id(p.sd_model)
            for style_text, weight in self.style_chunks:
                for artist in style_text.split(','):
                    artist = artist.strip()
                    if not artist: continue
                    
                    if self.base_prompt:
                        full_prompt = f"{artist}, {self.base_prompt}"
                    else:
                        full_prompt = artist
                        
                    cache_key = (model_id, full_prompt)
                    if cache_key in _STYLE_EMBEDDING_CACHE:
                        cond = _STYLE_EMBEDDING_CACHE[cache_key]
                        print(f"[Cross Atten Injector] Used cached embedding for: '{full_prompt}'")
                    else:
                        try:
                            cond = p.sd_model.get_learned_conditioning([full_prompt])
                        except Exception:
                            cond = p.sd_model.get_learned_conditioning(full_prompt)
                            
                        _STYLE_EMBEDDING_CACHE[cache_key] = cond
                        print(f"[Cross Atten Injector] Encoded and cached embedding for: '{full_prompt}'")
                        
                    self.style_embeddings.append({
                        "name": artist,
                        "cond": cond,
                        "weight": weight
                    })
        else:
            print("[Cross Atten Injector] Warning: p.sd_model doesn't have get_learned_conditioning.")
            return

        # Dynamically wrap CrossAttention blocks in the UNet
        if hasattr(p.sd_model, 'forge_objects') and hasattr(p.sd_model.forge_objects, 'unet'):
            import inspect
            unet_model = p.sd_model.forge_objects.unet.model
            count = 0
            
            print(f"[Cross Atten Injector] Scanning UNet modules for CrossAttention blocks...")
            skipped_modules = {}
            
            for name, module in unet_model.named_modules():
                # Skip basic torch.nn modules to speed up inspection
                if module.__class__.__module__.startswith('torch.nn'):
                    continue
                    
                # Inspect signature to see if it accepts context or encoder_hidden_states
                try:
                    sig = inspect.signature(module.forward)
                    has_context = 'context' in sig.parameters or 'encoder_hidden_states' in sig.parameters
                except Exception:
                    has_context = False
                    
                # Additional check: Does it have context_dim (standard in LDM/ComfyUI/Anima)
                has_context_dim = hasattr(module, 'context_dim') or hasattr(module, 'cross_attention_dim')
                
                # Check naming heuristics as a fallback/filter
                name_lower = name.lower()
                class_lower = module.__class__.__name__.lower()
                is_attn_module = "attn" in name_lower or "attn" in class_lower
                
                if is_attn_module and has_context and has_context_dim:
                    print(f"  [+] Found compatible module: '{name}' (class: {class_lower})")
                    # Found a cross-attention block!
                    parent_path = name.split('.')
                    if len(parent_path) > 1:
                        parent_name = '.'.join(parent_path[:-1])
                        child_name = parent_path[-1]
                        parent_module = unet_model.get_submodule(parent_name)
                    else:
                        parent_module = unet_model
                        child_name = name
                        
                    original_module = getattr(parent_module, child_name)
                    if not isinstance(original_module, CrossAttnWrapper):
                        wrapper = CrossAttnWrapper(original_module, self.style_embeddings, self.overall_strength, self.artist_ema_alpha, self.combine_mode)
                        setattr(parent_module, child_name, wrapper)
                        self.wrapped_modules.append((parent_module, child_name, original_module))
                        count += 1
                elif is_attn_module:
                    skipped_modules[name] = f"has_context={has_context}, has_context_dim={has_context_dim}"
                        
            print(f"[Cross Atten Injector] Successfully hooked {count} CrossAttention modules.")
            if count == 0:
                print(f"[Cross Atten Injector] ERROR: No cross-attention modules found to hook! Injection failed.")
                print(f"[Cross Atten Injector] Skipped Attn Modules log: {skipped_modules}")
        else:
            print("[Cross Atten Injector] Warning: Cannot find forge_objects.unet.")

    def postprocess(self, p, processed, *args):
        # Restore original modules
        for parent_module, child_name, original_module in self.wrapped_modules:
            setattr(parent_module, child_name, original_module)
        self.wrapped_modules.clear()

class CrossAttnInjectorStep(GenerationStep):
    id = "cross_attn_injector"
    name = "Cross Atten Style Injector"
    is_plugin = True
    sort_index = 25  # Run after SetupProcessingStep

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        return {"in": [SdProcessing], "out": [SdProcessing]}
    
    @classmethod
    def get_params(cls):
        return [
            {"name": "enabled", "type": "bool", "label": "Enable", "default": False, "is_generation_param": False},
            {"name": "style_prompts", "type": "text", "label": "Style Prompts", "default": ""},
            {"name": "strength", "type": "float", "label": "Overall Strength", "default": 1.0, "min": 0.0, "max": 4.0, "step": 0.1},
            {"name": "artist_ema_alpha", "type": "float", "label": "Artist EMA Alpha", "default": 0.0, "min": 0.0, "max": 0.99, "step": 0.05},
            {"name": "combine_mode", "type": "enum", "label": "Combine Mode", "choices": ["Output Avg", "SVD Lowrank", "Concat"], "default": "Output Avg"},
        ]
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        def _get(k, default):
            v = raw_params.get(k)
            return default if v is None else v
        return {
            "enabled": bool(_get("enabled", False)),
            "style_prompts": str(_get("style_prompts", "")),
            "strength": float(_get("strength", 1.0)),
            "artist_ema_alpha": float(_get("artist_ema_alpha", 0.0)),
            "combine_mode": str(_get("combine_mode", "Output Avg")),
        }
        
    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        is_enabled = ctx.var.get("enabled", False)
        p = ctx.get(SdProcessing)
        if not is_enabled or not p:
            return ctx
            
        style_prompts = ctx.var.get("style_prompts", "")
        strength = ctx.var.get("strength", 1.0)
        artist_ema_alpha = ctx.var.get("artist_ema_alpha", 0.0)
        combine_mode = ctx.var.get("combine_mode", "Output Avg")
        base_prompt = getattr(p, "prompt", "")
        
        # Attach the script
        injector_script = CrossAttnInjectorPatchScript(style_prompts, base_prompt, strength, combine_mode, artist_ema_alpha)
        injector_script.args_from = len(p.script_args) if p.script_args else 0
        injector_script.args_to = injector_script.args_from
        
        if getattr(p, "scripts", None) is not None and getattr(p.scripts, "alwayson_scripts", None) is not None:
            p.scripts.alwayson_scripts.append(injector_script)
        elif getattr(p, "scripts", None) is None:
            from modules.scripts import ScriptRunner
            p.scripts = ScriptRunner()
            p.scripts.alwayson_scripts = [injector_script]
            
        return ctx
