from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .agents import GeminiVisionAnalysisAdapter, MockVisionAnalysisAgent, ShapeSpecAgent, image_to_description_tool
from .exports import export_bundle_tool, geometry_to_files, write_files_to_dir, generate_template_svg_tool
from .geometry import generate_geometry, validate_geometry
from .models import JobRecord, VesselSpec
from .utils import ensure_dir

app = FastAPI(title="Slab Lab App")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = ensure_dir(Path(__file__).resolve().parents[1] / "slablab_jobs")
JOBS: dict[str, JobRecord] = {}
VISION_AGENT = GeminiVisionAnalysisAdapter()
FALLBACK_VISION_AGENT = MockVisionAnalysisAgent()
logger = logging.getLogger(__name__)


def _job_dir(job_id: str) -> Path:
    return ensure_dir(BASE_DIR / job_id)


@app.post("/api/analyze-image")
async def analyze_image(request: Request):
    image_bytes = await request.body()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="No image bytes received.")
    filename = request.headers.get("x-filename")
    logger.info("analyze_image_request filename=%s bytes=%s", filename or "", len(image_bytes))
    try:
        analysis = VISION_AGENT.analyze(image_bytes, filename=filename)
        logger.info("analyze_image_provider=gemini family=%s confidence=%s", analysis.detected_family, analysis.confidence)
    except Exception as exc:
        logger.warning("analyze_image_provider_fallback reason=%s", exc)
        analysis = FALLBACK_VISION_AGENT.analyze(image_bytes, filename=filename)
        analysis.warnings.append(f"Gemini analysis unavailable; returned mock analysis instead. ({exc})")
    return {"analysis": analysis.model_dump(), "description": image_to_description_tool(analysis)}


@app.post("/api/spec-from-description")
async def spec_from_description(payload: dict):
    description = payload.get("description")
    if not description:
        raise HTTPException(status_code=400, detail="description is required")
    spec = ShapeSpecAgent().from_description(description, source_type="text")
    return spec.model_dump()


@app.post("/api/generate")
async def generate(payload: dict):
    try:
        spec = VesselSpec.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid VesselSpec: {exc}") from exc
    job_id = uuid.uuid4().hex[:12]
    job = JobRecord(job_id=job_id, status="running", spec=spec, description=spec.source_description)
    JOBS[job_id] = job
    job_dir = _job_dir(job_id)
    try:
        geometry = generate_geometry(spec)
        svg = generate_template_svg_tool(spec, geometry)
        validation = validate_geometry(spec, geometry, svg)
        files = geometry_to_files(spec, geometry, validation)
        job.files = write_files_to_dir(job_dir, files)
        bundle = export_bundle_tool(files)
        bundle_path = job_dir / "bundle.zip"
        bundle_path.write_bytes(bundle)
        job.files.append({"name": "bundle.zip", "path": str(bundle_path)})
        job.validation = validation
        job.status = "complete"
        preview_obj = files["preview.obj"].decode("utf-8")
        return {
            "job_id": job_id,
            "status": job.status,
            "files": job.files,
            "validation": validation.model_dump(),
            "preview_svg": svg,
            "preview_obj": preview_obj,
            "mesh_spans": geometry.mesh_spans,
            "mesh_vertex_spans": geometry.mesh_vertex_spans,
        }
    except Exception as exc:
        job.status = "failed"
        job.errors.append(str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job id")
    return job.model_dump()


@app.get("/api/files/{job_id}")
async def get_file(job_id: str, name: str):
    path = _job_dir(job_id) / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@app.get("/api/health")
async def health():
    return {"ok": True}
