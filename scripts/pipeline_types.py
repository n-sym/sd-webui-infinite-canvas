from dataclasses import dataclass, field
from typing import Any, Dict, Optional, List
from scripts.typing_system import *

@dataclass
class SamplerConfigData:
    steps: int
    cfg_scale: float
    shift: float
    denoising_strength: float
    sampler_name: str
    scheduler: str
    seed: int

@dataclass
class ResolutionData:
    gen_width: int
    gen_height: int
    generation_res: int

@dataclass
class CanvasConfigData:
    outpaint_pad: str
    inpainting_fill: str
    upscaler_name: str
    auto_scale: bool
    downscale_algo: str
    compile_preset: str

def match_type(stored_t: Any, query_t: Any) -> bool:
    """Powerful generic matching engine"""
    # 1. Direct subclass (e.g. InputImage is a subclass of Image3)
    try:
        if issubclass(stored_t, query_t):
            return True
    except TypeError:
        pass
        
    # 2. Check Var[Name, Type] generic logic
    query_bases = getattr(query_t, "__bases__", [])
    stored_bases = getattr(stored_t, "__bases__", [])
    
    query_is_var = len(query_bases) > 0 and query_bases[0] is Var
    stored_is_var = len(stored_bases) > 0 and stored_bases[0] is Var
    
    if query_is_var:
        q_args = getattr(query_t, "__args__", [])
        if len(q_args) == 2:
            q_name, q_type = q_args
            
            if stored_is_var:
                s_args = getattr(stored_t, "__args__", [])
                if len(s_args) == 2:
                    s_name, s_type = s_args
                    # Name is Ellipsis (...) for wildcard, or exact match
                    name_matches = (q_name is Ellipsis) or (q_name == s_name)
                    # Recursively check internal type
                    type_matches = match_type(s_type, q_type)
                    return name_matches and type_matches
            else:
                # Fallback for anonymous types: e.g. query Var[..., Image3], stored normal Image3
                if q_name is Ellipsis:
                    return match_type(stored_t, q_type)
                    
    return False

def get_type_name(t: Any) -> str:
    query_bases = getattr(t, "__bases__", [])
    if len(query_bases) > 0 and query_bases[0] is Var:
        args = getattr(t, "__args__", [])
        if len(args) >= 1 and args[0] is not Ellipsis:
            return str(args[0])
    if hasattr(t, "__name__"):
        return t.__name__
    return str(t)

def get_pipeline_choices(pipeline: List[Any], current_sort_index: int, target_type: Any) -> List[str]:
    """Scans the pipeline for nodes that run before current_sort_index, and collects their outputs matching target_type.
    Applies shadowing: if multiple nodes output the exact same type, the later one shadows the earlier ones."""
    
    # Use a dict keyed by the specific type class to enforce shadowing
    choices_dict = {}
            
    if not pipeline:
        return list(choices_dict.values())
        
    for step_cls in pipeline:
        if getattr(step_cls, 'sort_index', 0) >= current_sort_index:
            continue
        sig = getattr(step_cls, 'type_signature', lambda: {"out": []})()
        for out_t in sig.get("out", []):
            if match_type(out_t, target_type):
                # The later node's output shadows the earlier one for this specific type
                choices_dict[out_t] = f"{get_type_name(out_t)}"
                
    # Remove duplicates but preserve order
    return list(dict.fromkeys(choices_dict.values()))

@dataclass
class TypedRecord:
    source_id: str
    type_class: Any
    value: Any

@dataclass
class GenerationCtx:
    # 1. Original Inputs
    id_task: str = ""
    payload_json: str = ""
    step_params: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    var: Dict[str, Any] = field(default_factory=dict)  # Injected during pipeline loop

    # Runtime control attributes
    is_resuming: bool = False
    resume_sort_index: int = 18
    dynamic_dialog_result: Optional[Dict] = None

    # Typed records storage
    typed_records: List[TypedRecord] = field(default_factory=list)

    def set(self, t: Any, value: Any, source_id: Optional[str] = None) -> None:
        if source_id is None:
            source_id = get_type_name(t)
        self.typed_records.append(TypedRecord(source_id=source_id, type_class=t, value=value))

    def filter(self, t: Any) -> Dict[str, Any]:
        results = {}
        for record in self.typed_records:
            if match_type(record.type_class, t):
                results[record.source_id] = record.value
        return results

    def get(self, t: Any) -> Any:
        res = self.filter(t)
        if res:
            return list(res.values())[-1]
        return None
        
    def has_error(self) -> bool:
        return self.get(Error) is not None
        
    def clear(self, t: Any) -> None:
        self.typed_records = [r for r in self.typed_records if not match_type(r.type_class, t)]


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

        Returns ``{"in": [...], "out": [...]}`` where each item is a type class
        from the project's vocabulary defined in `typing_system.py` (Prompt, GeneratedImage, 
        Processing, Mask, Resolution, SamplerConfig, ...).

        It supports mapping generics like `Prompt >> Prompt` and `Var[String] >> Prompt`.
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
