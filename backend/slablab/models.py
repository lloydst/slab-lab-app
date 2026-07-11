from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


class ImageShapeAnalysis(BaseModel):
    description: str
    detected_family: str
    confidence: float
    symmetry: str
    estimated_height_ratio: float | None = None
    estimated_top_to_bottom_ratio: float | None = None
    rim_description: str | None = None
    base_description: str | None = None
    detected_features: list[str] = Field(default_factory=list)
    ignored_features: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AssemblyPart(BaseModel):
    name: str
    family: Literal[
        "cube",
        "polygon_prism",
        "tapered_polygon",
        "round_frustum",
        "scallop_frustum",
        "oval_cylinder",
        "faceted_star",
        "slab_box",
        "slab_tray",
        "round_lid",
        "polygon_lid",
        "oval_lid",
    ]
    height_mm: float
    bottom_diameter_mm: float
    top_diameter_mm: float
    sides: int | None = None
    scallops: int | None = None
    scallop_depth_mm: float | None = None
    oval_major_mm: float | None = None
    oval_minor_mm: float | None = None
    facets: int | None = None
    ripple_mm: float | None = None
    offset_x_mm: float = 0
    offset_y_mm: float = 0
    offset_z_mm: float = 0
    notes: list[str] = Field(default_factory=list)


class VesselSpec(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    name: str
    family: Literal[
        "cube",
        "polygon_prism",
        "tapered_polygon",
        "round_frustum",
        "scallop_frustum",
        "oval_cylinder",
        "faceted_star",
        "slab_box",
        "slab_tray",
        "round_lid",
        "polygon_lid",
        "oval_lid",
    ]
    height_mm: float
    bottom_diameter_mm: float
    top_diameter_mm: float
    sides: int | None = None
    scallops: int | None = None
    scallop_depth_mm: float | None = None
    oval_major_mm: float | None = None
    oval_minor_mm: float | None = None
    facets: int | None = None
    ripple_mm: float | None = None
    shrinkage_percent: float = 0
    source_type: Literal["text", "image"]
    source_description: str
    confidence: float | None = None
    warnings: list[str] = Field(default_factory=list)
    assembly_parts: list[AssemblyPart] = Field(default_factory=list)


class ValidationReport(BaseModel):
    valid: bool
    buildable: bool
    closure_ok: bool
    base_perimeter_mm: float
    matched_edges_mm: float
    svg_units_ok: bool
    approximate: bool
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class GeometryFileSet(BaseModel):
    template_svg: str
    preview_obj: str
    preview_gltf: str | None = None
    preview_pdf: bytes
    spec_json: str
    validation_json: str
    thumbnail_png: bytes | None = None


class JobRecord(BaseModel):
    job_id: str
    status: Literal["queued", "running", "complete", "failed"]
    spec: VesselSpec | None = None
    analysis: ImageShapeAnalysis | None = None
    description: str | None = None
    validation: ValidationReport | None = None
    files: list[dict] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
