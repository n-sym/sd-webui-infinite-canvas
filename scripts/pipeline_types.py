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
    inpainting_fill: str = "original"
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

    # 7. Captured after the first pass so the "reuse seed" button can re-apply
    # the actual seed Forge sampled (which differs from ctx.seed when seed=-1).
    used_seed: Optional[int] = None


class GenerationStep:
    id: str = "base_step"
    name: str = "Base Step"
    is_plugin: bool = False
    sort_index: int = 500
    
    @classmethod
    def get_params(cls) -> list[Dict[str, Any]]:
        """Return the list of params this step exposes to the UI.

        Each param dict supports the documented keys (name/type/label/default,
        and min/max/step for numeric types, choices for enum). Additionally it
        may carry an ``is_generation_param`` flag that drives where the param
        is rendered in the UI:

        - ``is_generation_param: True`` (also the default when omitted) → the
          param is a per-generation value (strength, scale, prompt tags, …).
          It shows up in the sidebar's collapsible cards and is shipped with
          every generate request.
        - ``is_generation_param: False`` → the param is a persistent setting
          (API key/URL, model name, cache toggle, and ``enabled`` itself).
          It only appears in the overlay settings column and is NOT shown in
          the sidebar.

        ``enabled`` is always a setting (is_generation_param=False): the sidebar
        lists only enabled plugins, so toggling enabled from the sidebar would
        be circular.
        """
        return []

    @classmethod
    def resolve_params(cls, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        return raw_params

    @classmethod
    def type_signature(cls) -> Dict[str, list]:
        """Functional-style type hint: which semantic ctx slots this step
        reads (``in``) and writes (``out``).

        Returns ``{"in": [...], "out": [...]}`` where each item is a type name
        from the project's vocabulary (Prompt, GeneratedImage, Processing,
        Mask, Resolution, SamplerConfig, ...). The vocabulary maps semantically
        related ctx fields to one type — e.g. steps/cfg/sampler/seed/... all
        collapse to ``SamplerConfig``.

        Rules:
          - CLOSURE (excluded): ``ctx.var`` and ``ctx.step_params`` (the
            param-driven values declared via get_params), and any private
            helper fields. They're inputs to the step but not part of the
            declared dataflow.
          - In-place transform: if a step READS and WRITES the same type
            (e.g. LLMPromptOptimize reads+writes Prompt, EdgeFix reads+writes
            GeneratedImage), the type appears in BOTH ``in`` and ``out``.
          - ``Error`` appears in ``out`` only for steps that actively set
            ``ctx.is_error``/``ctx.error_message`` on failure paths.

        QUESTION (TODO): cross-step param reads are currently treated as
        closure and ignored — e.g. SetupProcessingStep reads
        ``ctx.step_params["latent_blend"]["power"]`` and EdgeFixStep reads
        ``ctx.step_params["latent_blend"]``. These are real cross-plugin
        dependencies (edge_fix/processing depend on latent_blend's params),
        but modelling them needs a separate type vocabulary (per-plugin param
        slots) and is deferred. If precise dependency analysis is needed
        later, these should become typed READs.
        """
        return {"in": [], "out": []}

    def __call__(self, ctx: GenerationCtx) -> GenerationCtx:
        return ctx
