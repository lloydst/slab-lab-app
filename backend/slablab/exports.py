from __future__ import annotations

import io
import json
import math
import zipfile
from pathlib import Path

from .geometry import GeometryResult, mesh_to_obj, mesh_to_gltf
from .models import ValidationReport, VesselSpec
from .utils import ensure_dir, mm


def _path_to_svg_d(path: list[tuple[float, float]]) -> str:
    return " ".join([f"M {path[0][0]:.2f} {path[0][1]:.2f}"] + [f"L {x:.2f} {y:.2f}" for x, y in path[1:]])


def _paths_bounds(paths: list[list[tuple[float, float]]]) -> tuple[float, float, float, float] | None:
    points = [point for path in paths for point in path]
    if not points:
        return None
    xs = [x for x, _ in points]
    ys = [y for _, y in points]
    return min(xs), min(ys), max(xs), max(ys)


def _shift_paths(
    paths: list[list[tuple[float, float]]],
    dx: float,
    dy: float,
) -> list[list[tuple[float, float]]]:
    return [[(x + dx, y + dy) for x, y in path] for path in paths]


def _estimate_text_width(text: str, font_size: float) -> float:
    return len(text) * font_size * 0.6


def _truncate_to_width(text: str, max_width: float, font_size: float) -> str:
    if not text:
        return text
    if _estimate_text_width(text, font_size) <= max_width:
        return text
    max_chars = max(int(max_width / (font_size * 0.6)) - 3, 0)
    if max_chars <= 0:
        return "..."
    return text[:max_chars].rstrip() + "..."


def _wrap_text_segments(segments: list[str], max_width: float, font_size: float) -> list[str]:
    if not segments:
        return []
    max_chars = max(int(max_width / (font_size * 0.6)), 1)
    lines: list[str] = []
    current = ""
    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue
        candidate = segment if not current else f"{current} | {segment}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        if len(segment) <= max_chars:
            current = segment
        else:
            lines.append(_truncate_to_width(segment, max_width, font_size))
            current = ""
    if current:
        lines.append(current)
    return lines


def _text_block(lines: list[str], x: float, y: float, font_size: float, fill: str) -> str:
    if not lines:
        return ""
    tspans = [f'<tspan x="{x:.2f}" dy="0">{lines[0]}</tspan>']
    for line in lines[1:]:
        tspans.append(f'<tspan x="{x:.2f}" dy="{font_size * 1.25:.2f}">{line}</tspan>')
    return f'<text x="{x:.2f}" y="{y:.2f}" font-size="{font_size}" fill="{fill}">{"".join(tspans)}</text>'


def _part_legend_elements(
    labels: list[str],
    anchor_x: float,
    anchor_y: float,
    max_text_width: float,
    font_size: float,
    available_height: float,
    gap: float = 8.0,
) -> tuple[list[str], float]:
    if not labels:
        return [], 0.0
    line_height = font_size * 1.5
    rows_per_column = max(int(available_height // line_height), 1)
    column_width = max_text_width + 4.0
    columns = math.ceil(len(labels) / rows_per_column)
    elements: list[str] = []
    for index, label in enumerate(labels):
        column = index // rows_per_column
        row = index % rows_per_column
        x = anchor_x + column * (column_width + gap)
        y = anchor_y + row * line_height
        elements.append(
            f'<text x="{x:.2f}" y="{y:.2f}" font-size="{font_size}" fill="#0f172a">{_truncate_to_width(label, max_text_width, font_size)}</text>'
        )
    total_width = columns * column_width + max(0, columns - 1) * gap
    return elements, total_width


def generate_template_svg_tool(spec: VesselSpec, geometry: GeometryResult) -> str:
    margin = 10.0
    spec_font_size = 4.0
    spec_text = (
        f"{spec.family} | {spec.name} | H={spec.height_mm:.1f}mm | "
        f"bottom={spec.bottom_diameter_mm:.1f}mm | top={spec.top_diameter_mm:.1f}mm"
    )
    if spec.assembly_parts:
        spec_text += f" | parts={len(spec.assembly_parts)}"
    header_width = max(geometry.template_width_mm, 1.0)
    if spec.assembly_parts:
        header_width = max(header_width, geometry.template_width_mm * 0.7)
    spec_lines = _wrap_text_segments(spec_text.split(" | "), header_width, spec_font_size)
    header_height = max(16.0, len(spec_lines) * spec_font_size * 1.35 + 4.0)
    content_top = margin + header_height
    bounds = _paths_bounds(geometry.template_paths)
    if bounds:
        min_x, min_y, max_x, max_y = bounds
        fitted_paths = _shift_paths(geometry.template_paths, margin - min_x, content_top - min_y)
        body_width = max_x - min_x
        body_height = max_y - min_y
    else:
        fitted_paths = []
        body_width = 0.0
        body_height = 0.0
    paths = []
    for path in fitted_paths:
        if not path:
            continue
        paths.append(f'<path d="{_path_to_svg_d(path)}" fill="none" stroke="#111827" stroke-width="0.75"/>')
    text_elements = []
    text_elements.append(_text_block(spec_lines, margin, margin + 6.0, spec_font_size, "#374151"))
    legend_elements: list[str] = []
    legend_width = 0.0
    if spec.assembly_parts and geometry.part_spans:
        label_x = margin + body_width + 8.0
        label_max_width = 0.0
        for name, start, count in geometry.part_spans:
            group_bounds = _paths_bounds(geometry.template_paths[start : start + count])
            if not group_bounds:
                continue
            _, group_min_y, _, _ = group_bounds
            label = _truncate_to_width(name, max(header_width, 48.0), spec_font_size)
            label_y = content_top + (group_min_y - min_y) + spec_font_size * 1.1
            legend_elements.append(
                f'<text x="{label_x:.2f}" y="{label_y:.2f}" font-size="{spec_font_size}" fill="#0f172a">{label}</text>'
            )
            label_max_width = max(label_max_width, _estimate_text_width(label, spec_font_size))
        legend_width = label_max_width
    width = max(body_width + margin * 2, margin + body_width + 8.0 + legend_width + margin if legend_elements else 0.0)
    height = max(content_top + body_height + margin, margin * 2 + len(spec_lines) * spec_font_size * 1.35 + 4.0)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{mm(width)}" height="{mm(height)}" viewBox="0 0 {width:.2f} {height:.2f}" overflow="hidden">
  <rect x="0" y="0" width="{width:.2f}" height="{height:.2f}" fill="white"/>
  {"".join(text_elements)}
  {"".join(legend_elements)}
  {"".join(paths)}
</svg>
'''
    return svg


def _pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def generate_template_pdf_tool(spec: VesselSpec, geometry: GeometryResult) -> bytes:
    width_pt = max(595.28, geometry.template_width_mm * 2.83465 + 40)
    height_pt = max(841.89, geometry.template_height_mm * 2.83465 + 80)
    ops = [
        "0 0 0 RG",
        "0 0 0 rg",
        "1 w",
        f"BT /F1 12 Tf 40 {height_pt - 40:.2f} Td ({_pdf_escape(spec.name)}) Tj ET",
    ]
    if spec.assembly_parts:
        parts_label = _pdf_escape(f"{len(spec.assembly_parts)} parts")
        ops.append(f"BT /F1 10 Tf 40 {height_pt - 56:.2f} Td ({parts_label}) Tj ET")
    for path in geometry.template_paths:
        if not path:
            continue
        pts = [(x * 2.83465 + 20, height_pt - (y * 2.83465 + 60)) for x, y in path]
        start = pts[0]
        ops.append(f"{start[0]:.2f} {start[1]:.2f} m")
        for x, y in pts[1:]:
            ops.append(f"{x:.2f} {y:.2f} l")
        ops.append("S")
    stream = "\n".join(ops).encode("utf-8")
    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width_pt:.2f} {height_pt:.2f}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(
            "ascii"
        )
    )
    objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"\nendstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    buf = io.BytesIO()
    buf.write(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(buf.tell())
        buf.write(f"{i} 0 obj\n".encode("ascii"))
        buf.write(obj)
        buf.write(b"\nendobj\n")
    xref_start = buf.tell()
    buf.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    buf.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buf.write(f"{offset:010d} 00000 n \n".encode("ascii"))
    buf.write(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF".encode("ascii")
    )
    return buf.getvalue()


def export_bundle_tool(files: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buffer.getvalue()


def geometry_to_files(spec: VesselSpec, geometry: GeometryResult, validation: ValidationReport) -> dict[str, bytes]:
    svg = generate_template_svg_tool(spec, geometry)
    obj = mesh_to_obj(geometry.mesh)
    _, gltf_bytes = mesh_to_gltf(geometry.mesh)
    pdf = generate_template_pdf_tool(spec, geometry)
    files = {
        "spec.json": json.dumps(spec.model_dump(), indent=2).encode("utf-8"),
        "validation.json": json.dumps(validation.model_dump(), indent=2).encode("utf-8"),
        "template.svg": svg.encode("utf-8"),
        "preview.obj": obj.encode("utf-8"),
        "preview.gltf": gltf_bytes,
        "template.pdf": pdf,
    }
    return files


def write_files_to_dir(out_dir: Path, files: dict[str, bytes]) -> list[dict[str, str]]:
    ensure_dir(out_dir)
    result = []
    for name, content in files.items():
        path = out_dir / name
        path.write_bytes(content)
        result.append({"name": name, "path": str(path)})
    return result
