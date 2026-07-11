from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from .agents import MockVisionAnalysisAgent, ShapeSpecAgent, image_to_description_tool
from .exports import export_bundle_tool, geometry_to_files, write_files_to_dir
from .geometry import generate_geometry, validate_geometry
from .models import VesselSpec
from .utils import ensure_dir


def _generate_from_description(description: str, out_dir: Path) -> Path:
    spec = ShapeSpecAgent().from_description(description, source_type="text")
    geometry = generate_geometry(spec)
    from .exports import generate_template_svg_tool

    svg = generate_template_svg_tool(spec, geometry)
    validation = validate_geometry(spec, geometry, svg)
    files = geometry_to_files(spec, geometry, validation)
    write_files_to_dir(out_dir, files)
    (out_dir / "bundle.zip").write_bytes(export_bundle_tool(files))
    return out_dir


def _analyze_image(image_path: Path, out_dir: Path) -> Path:
    data = image_path.read_bytes()
    analysis = MockVisionAnalysisAgent().analyze(data, filename=image_path.name)
    description = image_to_description_tool(analysis)
    payload = {
        "analysis": analysis.model_dump(),
        "description": description,
    }
    ensure_dir(out_dir)
    (out_dir / "analysis.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return out_dir


def main() -> None:
    parser = argparse.ArgumentParser(prog="slablab")
    sub = parser.add_subparsers(dest="command", required=True)

    gen = sub.add_parser("generate")
    gen.add_argument("--description", required=True)
    gen.add_argument("--out", required=True)

    img = sub.add_parser("analyze-image")
    img.add_argument("--image", required=True)
    img.add_argument("--out", required=True)

    args = parser.parse_args()
    out = Path(args.out)
    ensure_dir(out)
    if args.command == "generate":
        _generate_from_description(args.description, out)
    elif args.command == "analyze-image":
        _analyze_image(Path(args.image), out)
