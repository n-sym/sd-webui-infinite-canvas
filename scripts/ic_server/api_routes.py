from fastapi import APIRouter, FastAPI, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import traceback
import asyncio

from modules import shared, sd_samplers, sd_schedulers, script_callbacks
import modules.scripts as scripts

router = APIRouter(prefix="/infinite-canvas-api", tags=["Infinite Canvas"])

from fastapi import WebSocket, WebSocketDisconnect

# How often the server pushes a heartbeat / progress frame.
HEARTBEAT_INTERVAL = 25.0   # seconds — keeps proxies from dropping idle WS
PROGRESS_INTERVAL   = 0.5   # seconds — replaces the old 500ms client poll


class ConnectionManager:
    """Tracks active WS clients and offers a thread-safe broadcast helper so
    background threads (autosave executor, pipeline thread) can push messages
    onto the event loop without touching asyncio directly.

    Single-instance safety: this module lives in a subpackage
    (scripts.ic_server) that Forge's auto-loader does NOT scan, so there is
    exactly one import path -> one module object -> one `manager`. No identity
    drift, no need for a builtins/scan-based singleton hack."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Capture the running loop so thread-side callers can schedule onto it.
        if self.loop is None:
            self.loop = asyncio.get_running_loop()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, message: dict):
        """Async-side broadcast. Iterates over a snapshot so disconnects during
        iteration don't corrupt the list."""
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

    def broadcast_from_thread(self, message: dict):
        """Thread-safe broadcast for non-async callers (autosave executor,
        pipeline thread, etc.). No-op if the loop isn't bound yet."""
        loop = self.loop
        if loop is None or not loop.is_running():
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast_json(message), loop)
        except Exception as e:
            print(f"[Infinite Canvas] WS broadcast_from_thread failed: {e}")


manager = ConnectionManager()


def _build_progress_payload() -> dict:
    """Shared progress payload builder — used by both the WS push task and the
    GET /progress fallback endpoint so they can never drift apart."""
    progress_val = 0.01
    if shared.state.job_count > 0:
        progress_val += shared.state.job_no / shared.state.job_count
    if getattr(shared.state, 'sampling_steps', 0) > 0 and shared.state.job_count > 0:
        progress_val += 1 / shared.state.job_count * getattr(shared.state, 'sampling_step', 0) / getattr(shared.state, 'sampling_steps', 1)
    progress_val = min(progress_val, 1)
    return {
        "type": "progress",
        "active": shared.state.job_count > 0,
        "textinfo": getattr(shared.state, 'textinfo', ''),
        "state": {
            "sampling_step": getattr(shared.state, 'sampling_step', 0),
            "sampling_steps": getattr(shared.state, 'sampling_steps', 0),
        },
        "progress": progress_val,
    }


async def _ws_pusher_heartbeat():
    """Periodic heartbeat so proxies/load-balancers keep the WS alive even when
    no generation is running. Also refreshes manager.loop each tick so any
    background thread calling broadcast_from_thread always finds a live loop."""
    import time
    while True:
        manager.loop = asyncio.get_running_loop()
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        manager.broadcast_from_thread({"type": "heartbeat", "ts": time.time()})


async def _ws_pusher_progress():
    """Replaces the client-side 500ms `GET /progress` poll. While a job is
    active, pushes a progress frame every PROGRESS_INTERVAL; when it goes
    inactive, pushes one final inactive frame so the UI cleanly closes the
    toast rather than stranding it open."""
    was_active = False
    while True:
        manager.loop = asyncio.get_running_loop()
        active = shared.state.job_count > 0
        if active:
            manager.broadcast_from_thread(_build_progress_payload())
            was_active = True
        elif was_active:
            manager.broadcast_from_thread(_build_progress_payload())
            was_active = False
        await asyncio.sleep(PROGRESS_INTERVAL)


def _ensure_pushers_started():
    """Lazily kick off the heartbeat + progress push tasks if they haven't been
    started yet. Called from both the startup handler and the WS endpoint."""
    if getattr(manager, "_pushers_started", False):
        return
    loop = asyncio.get_event_loop()
    loop.create_task(_ws_pusher_heartbeat())
    loop.create_task(_ws_pusher_progress())
    manager._pushers_started = True


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    _ensure_pushers_started()
    try:
        while True:
            # Drain any client→server messages; we don't act on them but they
            # let the client use the socket for liveness pings if it wants.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@router.get("/options")
def get_options():
    try:
        preset = shared.opts.data.get("forge_preset", "sd")
        default_step = shared.opts.data.get(f"{preset}_i2i_step", 20)
        default_cfg = shared.opts.data.get(f"{preset}_i2i_cfg", 4.0)
        default_shift = shared.opts.data.get(f"{preset}_i2i_dcfg", 1.0)
        default_sampler = shared.opts.data.get(f"{preset}_i2i_sampler", "Euler")
        default_scheduler = shared.opts.data.get(f"{preset}_i2i_scheduler", "Beta")

        samplers = [x.name for x in sd_samplers.all_samplers]
        schedulers = ["Automatic"] + [x.label for x in sd_schedulers.schedulers]
        upscalers = [x.name for x in shared.sd_upscalers]

        return {
            "defaults": {
                "steps": default_step,
                "cfg_scale": default_cfg,
                "shift": default_shift,
                "sampler_name": default_sampler,
                "scheduler": default_scheduler,
                "denoising_strength": 0.6,
                "gen_width": 1024,
                "gen_height": 1024,
                "inpainting_fill": "original",
                "outpaint_pad": "Black",
                "upscaler_name": "None",
                "downscale_algo": "Bicubic",
                "compile_preset": "Disable",
                "auto_scale": True
            },
            "samplers": samplers,
            "schedulers": schedulers,
            "upscalers": upscalers,
            "outpaint_pad_choices": ["Black", "White", "Extend Edge", "Edge Blur"],
            "inpainting_fill_choices": ["fill", "original", "latent noise", "latent nothing"],
            "downscale_algo_choices": ["Bicubic", "Lanczos", "Bilinear", "Nearest"],
            "compile_preset_choices": ["Disable", "guard_filter_fn", "dynamic", "max-autotune", "max-autotune-no-cudagraphs", "reduce-overhead"]
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class GenerateRequest(BaseModel):
    id_task: Optional[str] = None
    payload_json: str

@router.post("/generate")
def generate(req: GenerateRequest):
    import scripts.node_manager
    from modules import shared
    from modules.call_queue import queue_lock

    with queue_lock:
        shared.state.begin(job=req.id_task)
        try:
            res = scripts.node_manager.api_generate(req.id_task, req.payload_json)
        finally:
            shared.state.end()
            shared.state.skipped = False
            shared.state.interrupted = False
            shared.state.stopping_generation = False
            shared.state.job_count = 0
            shared.state.job = ""
    return res

class ContRequest(BaseModel):
    id_task: Optional[str] = None
    payload_json: str

@router.post("/cont")
def cont(req: ContRequest):
    import scripts.node_manager
    from modules import shared
    from modules.call_queue import queue_lock

    with queue_lock:
        shared.state.begin(job=req.id_task)
        try:
            res = scripts.node_manager.api_cont(req.id_task, req.payload_json)
        finally:
            shared.state.end()
            shared.state.skipped = False
            shared.state.interrupted = False
            shared.state.stopping_generation = False
            shared.state.job_count = 0
            shared.state.job = ""
    return res

class ApplyRequest(BaseModel):
    feather: float = 0.0

@router.post("/apply")
def apply(req: ApplyRequest):
    import scripts.core_logic
    res = scripts.core_logic.api_apply(req.feather)
    return res

@router.post("/discard")
def discard():
    import scripts.core_logic
    res = scripts.core_logic.api_discard()
    return res

@router.post("/progress")
@router.get("/progress")
def progress():
    # Kept as a fallback for clients without a live WS connection. The WS
    # push task is the primary delivery channel now (see _ws_pusher_progress).
    return _build_progress_payload()

@router.get("/workflow")
def get_workflow():
    import scripts.node_manager
    res = scripts.node_manager.api_get_workflow()
    return res

class UpdateWorkflowRequest(BaseModel):
    payload_json: str

@router.post("/workflow/update")
def update_workflow(req: UpdateWorkflowRequest):
    import scripts.node_manager
    res = scripts.node_manager.api_update_workflow(req.payload_json)
    return res

class ValidateWorkflowRequest(BaseModel):
    payload_json: str

@router.post("/canvas/validate_workflow")
def validate_workflow(req: ValidateWorkflowRequest):
    import scripts.node_manager
    res = scripts.node_manager.api_validate_workflow(req.payload_json)
    return res

class SaveProjectRequest(BaseModel):
    payload_json: str
    prompt: str = ""
    negative_prompt: str = ""
    steps: int = 20
    cfg_scale: float = 4.0
    shift: float = 1.0
    denoising_strength: float = 0.6
    sampler_name: str = "Euler"
    scheduler: str = "Beta"
    gen_width: int = 1024
    gen_height: int = 1024
    seed: int = -1
    inpainting_fill: str = "original"
    outpaint_pad: str = "Black"
    upscaler_name: str = "None"
    downscale_algo: str = "Bicubic"
    project_name: str
    auto_scale: bool = True

@router.post("/projects/save")
def save_project(req: SaveProjectRequest):
    import scripts.core_logic
    res = scripts.core_logic.api_save_project(
        req.payload_json, req.prompt, req.negative_prompt, req.steps, req.cfg_scale,
        req.shift, req.denoising_strength, req.sampler_name, req.scheduler,
        req.gen_width, req.gen_height, req.seed, req.inpainting_fill, req.outpaint_pad,
        req.upscaler_name, req.downscale_algo, req.project_name, req.auto_scale
    )
    # The original api_save_project returned nothing. We will return success.
    return {"status": "success"}

@router.get("/projects/list")
def list_projects():
    import scripts.core_logic
    res = scripts.core_logic.api_list_projects_json()
    import json
    try:
        return json.loads(res)
    except:
        return []

class LoadProjectRequest(BaseModel):
    project_name: str
    recover_autosave: bool = False

@router.post("/projects/load")
def load_project(req: LoadProjectRequest):
    import scripts.core_logic
    res = scripts.core_logic.api_load_project(req.project_name, req.recover_autosave)
    if isinstance(res, dict):
        return res
    return {"error": "Failed to load project"}

class CheckAutosaveRequest(BaseModel):
    project_name: str

@router.post("/projects/check_autosave")
def check_autosave(req: CheckAutosaveRequest):
    import scripts.core_logic
    res = scripts.core_logic.api_check_project_autosave(req.project_name)
    return res

class SamPredictRequest(BaseModel):
    payload_json: str

@router.post("/sam_predict")
def sam_predict(req: SamPredictRequest):
    import scripts.core_logic
    res = scripts.core_logic.api_sam_predict(req.payload_json)
    return res

@router.post("/canvas/reset")
def reset_canvas():
    import scripts.core_logic
    res = scripts.core_logic.reset_canvas()
    return res

class ToggleStateRequest(BaseModel):
    state: str

@router.post("/canvas/toggle")
def toggle_state(req: ToggleStateRequest):
    import scripts.core_logic
    res = scripts.core_logic.toggle_state(req.state)
    return res

class UploadImageRequest(BaseModel):
    image_b64: str

@router.post("/upload")
def upload_image(req: UploadImageRequest):
    import scripts.core_logic
    import base64
    from io import BytesIO
    from PIL import Image
    try:
        header, encoded = req.image_b64.split(",", 1) if "," in req.image_b64 else ("", req.image_b64)
        image_data = base64.b64decode(encoded)
        img = Image.open(BytesIO(image_data))
        res = scripts.core_logic.handle_upload(img)
        return res
    except Exception as e:
        return {"error": str(e)}

class ImportProjectRequest(BaseModel):
    project_b64: str
    filename: str

@router.post("/projects/import")
def import_project(req: ImportProjectRequest):
    import scripts.core_logic
    import base64
    import os
    import tempfile
    try:
        header, encoded = req.project_b64.split(",", 1) if "," in req.project_b64 else ("", req.project_b64)
        data = base64.b64decode(encoded)

        # Save to temp file
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, req.filename)
        with open(temp_path, "wb") as f:
            f.write(data)

        res = scripts.core_logic.api_import_project(temp_path)
        return res
    except Exception as e:
        return {"error": str(e)}

@router.post("/dev/rebuild-js")
def dev_rebuild_js():
    import os
    try:
        # extension root = two levels up from this file (scripts/ic_server -> scripts -> root)
        extension_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
        src_js_dir = os.path.join(extension_dir, 'src', 'js')
        out_js_file = os.path.join(extension_dir, 'javascript', 'infinite_canvas.js')

        if os.path.exists(src_js_dir):
            js_files = sorted([f for f in os.listdir(src_js_dir) if f.endswith('.js')])
            merged_code = []
            for f in js_files:
                with open(os.path.join(src_js_dir, f), 'r', encoding='utf-8') as infile:
                    merged_code.append(infile.read())

            with open(out_js_file, 'w', encoding='utf-8') as outfile:
                outfile.write("\n\n".join(merged_code))
            return {"status": "success", "message": "JS rebuilt successfully. Please refresh the browser (F5) to apply changes."}
        else:
            return {"error": "src/js directory not found."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to rebuild JS: {str(e)}"}

@router.post("/dev/reload-python")
def dev_reload_python():
    import importlib
    import sys
    try:
        import scripts.core_logic
        import scripts.node_manager
        importlib.reload(scripts.core_logic)
        importlib.reload(scripts.node_manager)

        # Also reload the router module itself? That might be tricky since it's already mounted by FastAPI.
        # Usually reloading the core logic is enough for logic changes.
        return {"status": "success", "message": "Python modules (core_logic, node_manager) reloaded successfully."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": f"Failed to reload Python modules: {str(e)}"}

def on_app_started(demo, app: FastAPI):
    app.include_router(router)

    # Bind the event loop + kick off the push tasks from inside an async startup
    # handler so we're guaranteed to be running on uvicorn's actual loop (the
    # sync on_app_started callback may run before/after the loop is live).
    # Background threads (autosave executor, pipeline) read manager.loop to
    # schedule broadcasts; binding it here means it's never None once the
    # server is up, regardless of WS connect timing.
    @app.on_event("startup")
    async def _ic_bind_loop_and_pushers():
        manager.loop = asyncio.get_running_loop()
        _ensure_pushers_started()

script_callbacks.on_app_started(on_app_started)
