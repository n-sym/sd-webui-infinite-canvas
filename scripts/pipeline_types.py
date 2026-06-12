from dataclasses import dataclass, field
from typing import Any, Dict, Optional

@dataclass
class GenerationCtx:
    # 1. Original Inputs
    id_task: str = ""
    payload_json: str = ""
    prompt: str = ""
    negative_prompt: str = ""
    steps: int = 20
    cfg_scale: float = 7.0
    shift: float = 3.0
    denoising_strength: float = 0.6
    sampler_name: str = "Euler a"
    scheduler: str = "Automatic"
    gen_width: int = 1024
    gen_height: int = 1024
    seed: int = -1
    inpainting_fill_idx: int = 1
    outpaint_pad: str = "Black"
    upscaler_name: str = "None"
    auto_scale: bool = False
    downscale_algo: str = "Bicubic"

    # Dictionary-driven namespace for modules
    step_params: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    var: Dict[str, Any] = field(default_factory=dict)  # Injected during pipeline loop

    # 2. Extracted from Payload
    source_rect: Dict = field(default_factory=dict)
    target_rect: Dict = field(default_factory=dict)
    mask_base64: str = ""

    # 3. Canvas Prep
    generation_res: int = 1024
    init_image: Optional[Any] = None
    mask: Optional[Any] = None
    paste_mask: Optional[Any] = None
    canvas_source_rect: Dict = field(default_factory=dict)
    prep_info: Dict = field(default_factory=dict)

    # 4. Processing Object (A1111)
    p: Optional[Any] = None

    # 5. Intermediate/Final Masks & Images
    mask_gen_size_arr: Optional[Any] = None
    symmetric_soft_mask_arr: Optional[Any] = None
    result_img: Optional[Any] = None
    blured_edge_mask_arr: Optional[Any] = None
    actual_mask_arr: Optional[Any] = None
    hard_edge_mask_arr: Optional[Any] = None

    # 6. Outputs
    final_payload: str = ""
    is_error: bool = False
    error_message: str = ""


class GenerationStep:
    id: str = "base_step"
    name: str = "Base Step"
    is_plugin: bool = False
    sort_index: int = 500
    
    @classmethod
    def get_params(cls) -> list[Dict[str, Any]]:
        return []
        
    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return raw_params

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        return ctx
