class TypeMapping:
    def __init__(self, src, dst):
        self.src = src
        self.dst = dst
        
    def __repr__(self):
        src_name = getattr(self.src, "__name__", str(self.src))
        dst_name = getattr(self.dst, "__name__", str(self.dst))
        return f"{src_name} -> {dst_name}"

    def to_json(self):
        return {
            "mapping": True,
            "source": getattr(self.src, "to_json", lambda: {"type": self.src.__name__ if hasattr(self.src, "__name__") else str(self.src)})(),
            "target": getattr(self.dst, "to_json", lambda: {"type": self.dst.__name__ if hasattr(self.dst, "__name__") else str(self.dst)})()
        }

class TypeMeta(type):
    def __getitem__(cls, params):
        if not isinstance(params, tuple):
            params = (params,)
        
        param_names = []
        for p in params:
            if p is ...:
                param_names.append("AnySize")
            elif hasattr(p, "__name__"):
                param_names.append(p.__name__)
            elif hasattr(p, "value"): # Handle user's FloatLiteral or similar custom objects
                param_names.append(str(p.value))
            else:
                param_names.append(str(p))
                
        name = f"{cls.__name__}[{', '.join(param_names)}]"
        return type(name, (cls,), {"__args__": params})

    def __rshift__(cls, other):
        return TypeMapping(cls, other)

    def to_json(cls):
        if hasattr(cls, "__args__"):
            params_out = []
            for p in getattr(cls, "__args__", []):
                if p is ...:
                    params_out.append("AnySize")
                elif hasattr(p, "__name__"):
                    params_out.append(p.__name__)
                elif hasattr(p, "value"):
                    params_out.append(p.value)
                else:
                    params_out.append(p)
            return {
                "type": cls.__bases__[0].__name__,
                "params": params_out
            }
        return {"type": cls.__name__}

class IC_Type(metaclass=TypeMeta):
    """Base class for Infinite Canvas Typing"""
    pass

# --- Built-in Helpers for Dimensions ---
class AnyType(IC_Type): pass
class AnySize(IC_Type): pass

# --- Primitives ---
class String(IC_Type): pass
class Float(IC_Type): pass
class Int(IC_Type): pass
class Boolean(IC_Type): pass

# --- Generics ---
class Array(IC_Type): pass
class Var(IC_Type): pass

# --- Vector & Tensor types ---
# Using `...` (Ellipsis) represents an indeterminate dimension.
class Float4(Array[Float, 4]): pass
class Float3(Array[Float, 3]): pass
class Image4(Array[Float4, ..., ...]): pass
class Image3(Array[Float3, ..., ...]): pass
class Image1(Array[Float, ..., ...]): pass

# --- Semantic Types ---
class Prompt(String): pass
class NegativePrompt(String): pass
class Error(String): pass
class SdProcessing(IC_Type): pass
class ControlNetLayer(IC_Type): pass
class SamplerConfig(IC_Type): pass
class Resolution(IC_Type): pass
class CanvasConfig(IC_Type): pass
class PasteMask(Image1): pass
class PreparedCanvas(IC_Type): pass
class SourceRect(IC_Type): pass
class TargetRect(IC_Type): pass
class MaskBase64(String): pass
class CanvasSourceRect(IC_Type): pass
class MaskGenSizeArr(Image1): pass
class SymmetricSoftMaskArr(Image1): pass
class BluredEdgeMaskArr(Image1): pass
class HardEdgeMaskArr(Image1): pass
class FinalPayload(String): pass
class UsedSeed(Int): pass
class SoftStop(IC_Type): pass
class InputImage(Image3): pass
class InputMask(Image1): pass
class GeneratedImage(Image3): pass
class FinalOutputImage(GeneratedImage): pass
class SdStyleInput(IC_Type): pass
class LatentBlend(IC_Type): pass
class Processing(IC_Type): pass
