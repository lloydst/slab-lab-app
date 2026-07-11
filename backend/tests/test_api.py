from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

import slablab.api as api_mod
from slablab.api import app


def _png_bytes():
    image = Image.new("RGB", (320, 500), "white")
    buf = BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def test_api_smoke(monkeypatch, tmp_path):
    monkeypatch.setattr(api_mod, "BASE_DIR", tmp_path / "jobs")
    monkeypatch.setattr(api_mod, "JOBS", {})
    client = TestClient(app)

    assert client.get("/api/health").json() == {"ok": True}
    spec = client.post(
        "/api/spec-from-description",
        json={"description": "A straight hexagonal cup with six equal sides and a clean geometric base."},
    ).json()
    assert spec["family"] == "polygon_prism"

    analysis = client.post(
        "/api/analyze-image",
        content=_png_bytes(),
        headers={"content-type": "image/png", "x-filename": "sample.png"},
    ).json()
    assert "analysis" in analysis and "description" in analysis

    result = client.post("/api/generate", json=spec).json()
    assert result["status"] == "complete"
    job_id = result["job_id"]
    job = client.get(f"/api/jobs/{job_id}").json()
    assert job["status"] == "complete"
    assert job["files"]
    file_resp = client.get(f"/api/files/{job_id}", params={"name": "template.svg"})
    assert file_resp.status_code == 200
