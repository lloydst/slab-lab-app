from __future__ import annotations

import base64
import struct
import math
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Mapping

from .models import AssemblyPart, ValidationReport, VesselSpec
from .utils import ellipse_circumference, regular_polygon_perimeter, regular_polygon_points


@dataclass
class Mesh:
    vertices: list[tuple[float, float, float]]
    faces: list[tuple[int, int, int]]


@dataclass
class GeometryResult:
    template_paths: list[list[tuple[float, float]]]
    template_width_mm: float
    template_height_mm: float
    mesh: Mesh
    notes: list[str]
    approximate: bool
    part_spans: list[tuple[str, int, int]] | None = None
    mesh_spans: list[tuple[str, int, int]] | None = None
    mesh_vertex_spans: list[tuple[str, int, int]] | None = None


class GeometryFamily(ABC):
    family_name: str

    @abstractmethod
    def build(self, spec: VesselSpec) -> GeometryResult:
        raise NotImplementedError


class ValidatingGeometryFamily(GeometryFamily):
    def validate(self, spec: VesselSpec, geometry: GeometryResult, svg_text: str) -> ValidationReport:
        warnings = list(spec.warnings) + list(geometry.notes)
        warnings.extend(self.validation_warnings(spec, geometry))
        errors = list(self.validation_errors(spec, geometry))
        closure_ok = all(path and path[0] == path[-1] for path in geometry.template_paths)
        svg_units_ok = 'width="' in svg_text and 'height="' in svg_text and "mm" in svg_text[:200]
        base_perimeter = self.base_perimeter_mm(spec, geometry)
        buildable = self.is_buildable(spec, geometry, errors)
        approximate = self.is_approximate(spec, geometry)
        if approximate:
            warnings.append("Template is approximate and should be confirmed against a physical mockup.")
        valid = buildable and closure_ok and svg_units_ok and not errors
        matched_edges_mm = geometry.template_width_mm
        return ValidationReport(
            valid=valid,
            buildable=buildable,
            closure_ok=closure_ok,
            base_perimeter_mm=base_perimeter,
            matched_edges_mm=matched_edges_mm,
            svg_units_ok=svg_units_ok,
            approximate=approximate,
            warnings=list(dict.fromkeys(warnings)),
            errors=errors,
        )

    def validation_warnings(self, spec: VesselSpec, geometry: GeometryResult) -> list[str]:
        return []

    def validation_errors(self, spec: VesselSpec, geometry: GeometryResult) -> list[str]:
        return []

    def base_perimeter_mm(self, spec: VesselSpec, geometry: GeometryResult) -> float:
        return 0.0

    def is_buildable(self, spec: VesselSpec, geometry: GeometryResult, errors: list[str]) -> bool:
        return not errors and spec.height_mm > 0 and spec.bottom_diameter_mm > 0 and spec.top_diameter_mm > 0

    def is_approximate(self, spec: VesselSpec, geometry: GeometryResult) -> bool:
        return geometry.approximate


class SlabValidationFamily(ValidatingGeometryFamily):
    def validation_errors(self, spec: VesselSpec, geometry: GeometryResult) -> list[str]:
        if spec.bottom_diameter_mm <= 0:
            return ["Slab panel families require a positive side length."]
        return []

    def base_perimeter_mm(self, spec: VesselSpec, geometry: GeometryResult) -> float:
        return 4 * spec.bottom_diameter_mm


class PolygonValidationFamily(ValidatingGeometryFamily):
    def validation_errors(self, spec: VesselSpec, geometry: GeometryResult) -> list[str]:
        if (spec.sides or 0) < 3:
            return ["Polygon families require at least 3 sides."]
        return []

    def base_perimeter_mm(self, spec: VesselSpec, geometry: GeometryResult) -> float:
        radius = spec.bottom_diameter_mm / 2
        return regular_polygon_perimeter(spec.sides or 6, radius)


class RoundValidationFamily(ValidatingGeometryFamily):
    def base_perimeter_mm(self, spec: VesselSpec, geometry: GeometryResult) -> float:
        return math.pi * spec.bottom_diameter_mm

    def is_approximate(self, spec: VesselSpec, geometry: GeometryResult) -> bool:
        return geometry.approximate or spec.family == "scallop_frustum"


class OvalValidationFamily(ValidatingGeometryFamily):
    def validation_warnings(self, spec: VesselSpec, geometry: GeometryResult) -> list[str]:
        if (spec.oval_major_mm or 0) <= (spec.oval_minor_mm or 0):
            return ["Oval major axis should exceed minor axis."]
        return []

    def base_perimeter_mm(self, spec: VesselSpec, geometry: GeometryResult) -> float:
        return ellipse_circumference((spec.oval_major_mm or spec.top_diameter_mm) / 2,
                                     (spec.oval_minor_mm or spec.bottom_diameter_mm) / 2)

    def is_approximate(self, spec: VesselSpec, geometry: GeometryResult) -> bool:
        return True


class FacetedValidationFamily(ValidatingGeometryFamily):
    def base_perimeter_mm(self, spec: VesselSpec, geometry: GeometryResult) -> float:
        return 2 * math.pi * (spec.bottom_diameter_mm / 2)

    def is_approximate(self, spec: VesselSpec, geometry: GeometryResult) -> bool:
        return True


class LidValidationFamily(ValidatingGeometryFamily):
    def is_buildable(self, spec: VesselSpec, geometry: GeometryResult, errors: list[str]) -> bool:
        return not errors and spec.height_mm > 0 and spec.bottom_diameter_mm > 0


class CubeGeometryFamily(SlabValidationFamily):
    family_name = "cube"

    def build(self, spec: VesselSpec) -> GeometryResult:
        edge = max(spec.height_mm, spec.bottom_diameter_mm, spec.top_diameter_mm, 1.0)
        square = _close([(0.0, 0.0), (edge, 0.0), (edge, edge), (0.0, edge)])
        net_paths = [
            _translate_points(square, edge, 0.0),
            _translate_points(square, edge, edge),
            _translate_points(square, 0.0, edge),
            _translate_points(square, 2 * edge, edge),
            _translate_points(square, 3 * edge, edge),
            _translate_points(square, edge, 2 * edge),
        ]
        mesh = _mesh_from_profile(square[:-1], square[:-1], edge)
        return GeometryResult(net_paths, 4 * edge, 3 * edge, mesh, ["Cube geometry"], False)


class SlabBoxGeometryFamily(SlabValidationFamily):
    family_name = "slab_box"

    def build(self, spec: VesselSpec) -> GeometryResult:
        side = max(spec.bottom_diameter_mm, 1.0)
        height = max(spec.height_mm, 1.0)
        base = _rect_points(side, side)
        wall_paths = [
            _close([(0.0, 0.0), (side, 0.0), (side, height), (0.0, height)]),
            _close([(0.0, 0.0), (side, 0.0), (side, height), (0.0, height)]),
            _close([(0.0, 0.0), (side, 0.0), (side, height), (0.0, height)]),
            _close([(0.0, 0.0), (side, 0.0), (side, height), (0.0, height)]),
        ]
        positions = []
        gap = 8.0
        cursor = 0.0
        for path in wall_paths:
            positions.append(_translate_points(path, cursor, 0.0))
            cursor += side + gap
        positions.append(_translate_points(base, 0.0, height + 12.0))
        mesh = _open_box_mesh(side, height)
        return GeometryResult(positions, cursor - gap, height + side + 12.0, mesh,
                              ["Open box template built from square panels"], False)


class SlabTrayGeometryFamily(SlabValidationFamily):
    family_name = "slab_tray"

    def build(self, spec: VesselSpec) -> GeometryResult:
        side = max(spec.bottom_diameter_mm, 1.0)
        wall_height = max(spec.height_mm, 1.0)
        base = _rect_points(side, side)
        wall_paths = [
            _close([(0.0, 0.0), (side, 0.0), (side, wall_height), (0.0, wall_height)]),
            _close([(0.0, 0.0), (side, 0.0), (side, wall_height), (0.0, wall_height)]),
            _close([(0.0, 0.0), (side, 0.0), (side, wall_height), (0.0, wall_height)]),
            _close([(0.0, 0.0), (side, 0.0), (side, wall_height), (0.0, wall_height)]),
        ]
        positions = [base]
        gap = 8.0
        cursor = side + gap
        for path in wall_paths:
            positions.append(_translate_points(path, cursor, 0.0))
            cursor += side + gap
        mesh = _open_box_mesh(side, wall_height)
        return GeometryResult(positions, cursor - gap, max(side, wall_height), mesh,
                              ["Shallow tray template built from flat panels"], False)


class PolygonPrismGeometryFamily(PolygonValidationFamily):
    family_name = "polygon_prism"

    def build(self, spec: VesselSpec) -> GeometryResult:
        sides = spec.sides or 6
        radius = spec.bottom_diameter_mm / 2
        perimeter = regular_polygon_perimeter(sides, radius)
        width = perimeter / sides
        template_paths = []
        for i in range(sides):
            x0 = i * width
            template_paths.append(_close([(x0, 0.0), (x0 + width, 0.0), (x0 + width, spec.height_mm), (x0, spec.height_mm)]))
        pts = regular_polygon_points(sides, radius)
        mesh = _mesh_from_profile(pts, pts, spec.height_mm)
        return GeometryResult(template_paths, perimeter, spec.height_mm, mesh, ["Exact prism unwrap"], False)


class TaperedPolygonGeometryFamily(PolygonValidationFamily):
    family_name = "tapered_polygon"

    def build(self, spec: VesselSpec) -> GeometryResult:
        sides = spec.sides or 4
        bottom_r = spec.bottom_diameter_mm / 2
        top_r = spec.top_diameter_mm / 2
        bottom_pts = regular_polygon_points(sides, bottom_r)
        top_pts = regular_polygon_points(sides, top_r)
        bottom_perimeter = regular_polygon_perimeter(sides, bottom_r)
        top_perimeter = regular_polygon_perimeter(sides, top_r)
        template_paths = []
        bottom_w = bottom_perimeter / sides
        top_w = top_perimeter / sides
        for i in range(sides):
            x0 = i * max(bottom_w, top_w)
            template_paths.append(_close([(x0, 0.0), (x0 + bottom_w, 0.0), (x0 + top_w, spec.height_mm), (x0, spec.height_mm)]))
        mesh = _mesh_from_profile(bottom_pts, top_pts, spec.height_mm)
        return GeometryResult(template_paths, max(bottom_perimeter, top_perimeter), spec.height_mm, mesh,
                              ["Tapered polygon panels are computed from circumferences"], False)


class RoundFrustumGeometryFamily(RoundValidationFamily):
    family_name = "round_frustum"

    def build(self, spec: VesselSpec) -> GeometryResult:
        bottom_r = spec.bottom_diameter_mm / 2
        top_r = spec.top_diameter_mm / 2
        slant = math.sqrt((top_r - bottom_r) ** 2 + spec.height_mm ** 2)
        large_r = max(bottom_r, top_r)
        small_r = min(bottom_r, top_r)
        outer_r = slant * large_r / max(large_r - small_r, 1e-6)
        inner_r = max(outer_r - slant, 0.0)
        theta = 2 * math.pi * large_r / outer_r
        sector = _annulus_to_points(inner_r, outer_r, angle=theta)
        base = [(bottom_r * math.cos(2 * math.pi * i / 96), bottom_r * math.sin(2 * math.pi * i / 96)) for i in
                range(97)]
        mesh_bottom = [(bottom_r * math.cos(2 * math.pi * i / 48), bottom_r * math.sin(2 * math.pi * i / 48)) for i in
                       range(48)]
        mesh_top = [(top_r * math.cos(2 * math.pi * i / 48), top_r * math.sin(2 * math.pi * i / 48)) for i in range(48)]
        mesh = _mesh_from_profile(mesh_bottom, mesh_top, spec.height_mm)
        return GeometryResult([sector, _close(base)], max(outer_r * 2, bottom_r * 2), max(spec.height_mm, outer_r),
                              mesh, ["Exact conical frustum sector"], False)


class ScallopFrustumGeometryFamily(RoundValidationFamily):
    family_name = "scallop_frustum"

    def build(self, spec: VesselSpec) -> GeometryResult:
        bottom_r = spec.bottom_diameter_mm / 2
        top_r = spec.top_diameter_mm / 2
        scallops = spec.scallops or 6
        segments = scallops * 12
        width = math.pi * (top_r + bottom_r)
        points = []
        for i in range(segments + 1):
            x = width * i / segments
            phase = math.sin((scallops * 2 * math.pi * i) / segments)
            top_y = spec.height_mm + (spec.scallop_depth_mm or 8.0) * phase
            points.append((x, top_y))
        for i in range(segments, -1, -1):
            x = width * i / segments
            points.append((x, 0.0))
        strip = _close(points)
        bottom = [(bottom_r * math.cos(2 * math.pi * i / 96), bottom_r * math.sin(2 * math.pi * i / 96)) for i in
                  range(97)]
        top = [(top_r * math.cos(2 * math.pi * i / 96), top_r * math.sin(2 * math.pi * i / 96)) for i in range(97)]
        mesh = _mesh_from_profile(bottom[:-1], top[:-1], spec.height_mm)
        return GeometryResult([strip, _close(bottom)], width, spec.height_mm + (spec.scallop_depth_mm or 8.0), mesh,
                              ["Scalloped rim is approximate but computed"], True)


class OvalCylinderGeometryFamily(OvalValidationFamily):
    family_name = "oval_cylinder"

    def build(self, spec: VesselSpec) -> GeometryResult:
        major = spec.oval_major_mm or spec.top_diameter_mm
        minor = spec.oval_minor_mm or spec.bottom_diameter_mm
        width = ellipse_circumference(major / 2, minor / 2)
        strip = _close([(0.0, 0.0), (width, 0.0), (width, spec.height_mm), (0.0, spec.height_mm)])
        base = [(major / 2 * math.cos(2 * math.pi * i / 96), minor / 2 * math.sin(2 * math.pi * i / 96)) for i in
                range(97)]
        pts_bottom = base[:-1]
        pts_top = base[:-1]
        mesh = _mesh_from_profile(pts_bottom, pts_top, spec.height_mm)
        return GeometryResult([strip, _close(base)], width, spec.height_mm, mesh,
                              ["Oval footprint is clay-practical approximate"], True)


class FacetedStarGeometryFamily(FacetedValidationFamily):
    family_name = "faceted_star"

    def build(self, spec: VesselSpec) -> GeometryResult:
        facets = spec.facets or 8
        outer_r = spec.bottom_diameter_mm / 2
        inner_r = outer_r * 0.62
        base = _star_points(facets, outer_r, inner_r)
        strip_width = sum(math.dist(base[i], base[(i + 1) % len(base)]) for i in range(len(base)))
        top = base
        mesh = _mesh_from_profile(base[:-1], top[:-1], spec.height_mm)
        strip = _close([(0.0, 0.0), (strip_width, 0.0), (strip_width, spec.height_mm), (0.0, spec.height_mm)])
        return GeometryResult([strip, base], strip_width, spec.height_mm, mesh,
                              ["Faceted star is fold-practical approximate"], True)


class RoundLidGeometryFamily(LidValidationFamily):
    family_name = "round_lid"

    def build(self, spec: VesselSpec) -> GeometryResult:
        height = max(spec.height_mm, 1.0)
        bottom_r = max(spec.bottom_diameter_mm, 1.0) / 2
        top_r = max(spec.top_diameter_mm, bottom_r * 0.92) / 2
        body_r = max(bottom_r, top_r)
        dome_r = max(body_r * 0.96, body_r + height * 0.18)
        sector = _annulus_to_points(max(dome_r - height, 0.0), dome_r, angle=2 * math.pi)
        bottom = [(body_r * math.cos(2 * math.pi * i / 96), body_r * math.sin(2 * math.pi * i / 96)) for i in range(97)]
        mesh_bottom = [(body_r * math.cos(2 * math.pi * i / 48), body_r * math.sin(2 * math.pi * i / 48)) for i in
                       range(48)]
        mesh_top = [(top_r * math.cos(2 * math.pi * i / 48), top_r * math.sin(2 * math.pi * i / 48)) for i in range(48)]
        mesh = _mesh_from_profile(mesh_bottom, mesh_top, height)
        return GeometryResult([sector, _close(bottom)], max(dome_r * 2, body_r * 2), max(height, dome_r), mesh,
                              ["Round lid geometry"], False)


class PolygonLidGeometryFamily(LidValidationFamily):
    family_name = "polygon_lid"

    def build(self, spec: VesselSpec) -> GeometryResult:
        height = max(spec.height_mm, 1.0)
        sides = spec.sides or 6
        outer_r = max(spec.top_diameter_mm, spec.bottom_diameter_mm) / 2
        inner_r = max(outer_r * 0.82, 1.0)
        bottom_pts = regular_polygon_points(sides, inner_r)
        top_pts = regular_polygon_points(sides, outer_r)
        mesh = _mesh_from_profile(bottom_pts, top_pts, height)
        width = regular_polygon_perimeter(sides, outer_r)
        template = []
        for i in range(sides):
            x0 = i * (width / sides)
            template.append(_close([(x0, 0.0), (x0 + width / sides, 0.0), (x0 + width / sides, height), (x0, height)]))
        return GeometryResult(template, width, height, mesh, ["Polygon lid geometry"], False)


class OvalLidGeometryFamily(LidValidationFamily):
    family_name = "oval_lid"

    def build(self, spec: VesselSpec) -> GeometryResult:
        height = max(spec.height_mm, 1.0)
        major = spec.oval_major_mm or max(spec.top_diameter_mm, spec.bottom_diameter_mm)
        minor = spec.oval_minor_mm or min(spec.top_diameter_mm, spec.bottom_diameter_mm)
        width = ellipse_circumference(major / 2, minor / 2)
        template = [_close([(0.0, 0.0), (width, 0.0), (width, height), (0.0, height)])]
        base = [(major / 2 * math.cos(2 * math.pi * i / 96), minor / 2 * math.sin(2 * math.pi * i / 96)) for i in
                range(97)]
        mesh = _mesh_from_profile(base[:-1], base[:-1], height)
        return GeometryResult(template, width, height, mesh, ["Oval lid geometry"], False)


class GeometryFactory:
    def __init__(self, families: Mapping[str, GeometryFamily] | None = None):
        self._families = dict(families or {
            "cube": CubeGeometryFamily(),
            "slab_box": SlabBoxGeometryFamily(),
            "slab_tray": SlabTrayGeometryFamily(),
            "polygon_prism": PolygonPrismGeometryFamily(),
            "tapered_polygon": TaperedPolygonGeometryFamily(),
            "round_frustum": RoundFrustumGeometryFamily(),
            "scallop_frustum": ScallopFrustumGeometryFamily(),
            "oval_cylinder": OvalCylinderGeometryFamily(),
            "faceted_star": FacetedStarGeometryFamily(),
            "round_lid": RoundLidGeometryFamily(),
            "polygon_lid": PolygonLidGeometryFamily(),
            "oval_lid": OvalLidGeometryFamily(),
        })

    def build(self, spec: VesselSpec) -> GeometryResult:
        builder = self._families.get(spec.family)
        if builder is None:
            raise ValueError(f"Unsupported vessel family: {spec.family}")
        return builder.build(spec)

    def validate(self, spec: VesselSpec, geometry: GeometryResult, svg_text: str) -> ValidationReport:
        builder = self._families.get(spec.family)
        if builder is None:
            raise ValueError(f"Unsupported vessel family: {spec.family}")
        if not isinstance(builder, ValidatingGeometryFamily):
            raise ValueError(f"Unsupported validating family: {spec.family}")
        return builder.validate(spec, geometry, svg_text)


def _close(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if points and points[0] != points[-1]:
        return points + [points[0]]
    return points


def _sector_points(inner_r: float, outer_r: float, angle: float, segments: int = 96) -> list[list[tuple[float, float]]]:
    outer = []
    inner = []
    for i in range(segments + 1):
        t = angle * i / segments - angle / 2
        outer.append((outer_r * math.cos(t), outer_r * math.sin(t)))
        inner.append((inner_r * math.cos(angle / 2 - angle * i / segments),
                      inner_r * math.sin(angle / 2 - angle * i / segments)))
    return [_close(outer), _close(inner)]


def _annulus_to_points(inner_r: float, outer_r: float, angle: float = 2 * math.pi, segments: int = 96) -> list[
    tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for i in range(segments + 1):
        t = angle * i / segments
        pts.append((outer_r * math.cos(t), outer_r * math.sin(t)))
    for i in range(segments, -1, -1):
        t = angle * i / segments
        pts.append((inner_r * math.cos(t), inner_r * math.sin(t)))
    return _close(pts)


def _star_points(facets: int, outer_r: float, inner_r: float) -> list[tuple[float, float]]:
    pts = []
    for i in range(facets * 2):
        r = outer_r if i % 2 == 0 else inner_r
        t = math.pi * i / facets - math.pi / 2
        pts.append((r * math.cos(t), r * math.sin(t)))
    return _close(pts)


def _rect_points(width: float, height: float) -> list[tuple[float, float]]:
    return _close([(0.0, 0.0), (width, 0.0), (width, height), (0.0, height)])


def _open_box_mesh(side: float, height: float) -> Mesh:
    half = side / 2
    bottom = [
        (-half, -half, 0.0),
        (half, -half, 0.0),
        (half, half, 0.0),
        (-half, half, 0.0),
    ]
    top = [
        (-half, -half, height),
        (half, -half, height),
        (half, half, height),
        (-half, half, height),
    ]
    vertices = bottom + top
    faces: list[tuple[int, int, int]] = [
        (1, 2, 3),
        (1, 3, 4),
        (5, 7, 6),
        (5, 8, 7),
        (1, 2, 6),
        (1, 6, 5),
        (2, 3, 7),
        (2, 7, 6),
        (3, 4, 8),
        (3, 8, 7),
        (4, 1, 5),
        (4, 5, 8),
    ]
    return Mesh(vertices=vertices, faces=faces)


def _mesh_from_profile(
        bottom_pts: list[tuple[float, float]],
        top_pts: list[tuple[float, float]],
        height: float,
        cap_bottom: bool = True,
        cap_top: bool = True,
) -> Mesh:
    if len(bottom_pts) != len(top_pts):
        raise ValueError("Profiles must match in point count.")
    vertices = [(x, y, 0.0) for x, y in bottom_pts] + [(x, y, height) for x, y in top_pts]
    n = len(bottom_pts)
    faces: list[tuple[int, int, int]] = []
    for i in range(n):
        a = i
        b = (i + 1) % n
        c = n + (i + 1) % n
        d = n + i
        faces.append((a + 1, b + 1, c + 1))
        faces.append((a + 1, c + 1, d + 1))
    if cap_bottom and n >= 3:
        bottom_center = len(vertices) + 1
        vertices.append((sum(x for x, _ in bottom_pts) / n, sum(y for _, y in bottom_pts) / n, 0.0))
        for i in range(n):
            a = i
            b = (i + 1) % n
            faces.append((bottom_center, b + 1, a + 1))
    if cap_top and n >= 3:
        top_center = len(vertices) + 1
        vertices.append((sum(x for x, _ in top_pts) / n, sum(y for _, y in top_pts) / n, height))
        for i in range(n):
            a = n + i
            b = n + (i + 1) % n
            faces.append((top_center, a + 1, b + 1))
    return Mesh(vertices=vertices, faces=faces)


def _wall_strip_points(width: float, height: float, top_variation: float = 0.0, cycles: int = 6, segments: int = 48) -> \
list[tuple[float, float]]:
    top = []
    bottom = []
    for i in range(segments + 1):
        x = width * i / segments
        offset = top_variation * math.sin(cycles * 2 * math.pi * i / segments)
        top.append((x, height + offset))
        bottom.append((width - x, 0.0))
    return _close(bottom + top)


def _translate_points(points: list[tuple[float, float]], dx: float, dy: float) -> list[tuple[float, float]]:
    return [(x + dx, y + dy) for x, y in points]


def _translate_mesh(mesh: Mesh, dx: float = 0.0, dy: float = 0.0, dz: float = 0.0) -> Mesh:
    return Mesh(
        vertices=[(x + dx, y + dy, z + dz) for x, y, z in mesh.vertices],
        faces=list(mesh.faces),
    )


def _combine_meshes(meshes: list[Mesh]) -> Mesh:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    offset = 0
    for mesh in meshes:
        vertices.extend(mesh.vertices)
        faces.extend((a + offset, b + offset, c + offset) for a, b, c in mesh.faces)
        offset += len(mesh.vertices)
    return Mesh(vertices=vertices, faces=faces)


def _assembly_mesh_translation(part: AssemblyPart) -> tuple[float, float, float]:
    aligned_names = {"body", "lid", "finial", "collar", "foot_ring"}
    if part.name in aligned_names or part.offset_z_mm:
        return 0.0, 0.0, part.offset_z_mm
    return part.offset_x_mm, part.offset_y_mm, part.offset_z_mm


def _part_to_spec(part: AssemblyPart, source_type: str = "text",
                  source_description: str = "assembly part") -> VesselSpec:
    return VesselSpec(
        name=part.name,
        family=part.family,
        height_mm=part.height_mm,
        bottom_diameter_mm=part.bottom_diameter_mm,
        top_diameter_mm=part.top_diameter_mm,
        sides=part.sides,
        scallops=part.scallops,
        scallop_depth_mm=part.scallop_depth_mm,
        oval_major_mm=part.oval_major_mm,
        oval_minor_mm=part.oval_minor_mm,
        facets=part.facets,
        ripple_mm=part.ripple_mm,
        shrinkage_percent=0,
        source_type=source_type,  # type: ignore[arg-type]
        source_description=source_description,
        confidence=None,
        warnings=list(part.notes),
    )


GEOMETRY_FACTORY = GeometryFactory()


def _geometry_for_spec(spec: VesselSpec) -> GeometryResult:
    return GEOMETRY_FACTORY.build(spec)


def generate_geometry(spec: VesselSpec) -> GeometryResult:
    if spec.assembly_parts:
        template_paths: list[list[tuple[float, float]]] = []
        meshes: list[Mesh] = []
        part_spans: list[tuple[str, int, int]] = []
        mesh_spans: list[tuple[str, int, int]] = []
        mesh_vertex_spans: list[tuple[str, int, int]] = []
        notes = ["Assembly composed from multiple slab parts"]
        cursor_x = 0.0
        max_height = 0.0
        max_depth = 0.0
        for part in spec.assembly_parts:
            part_spec = _part_to_spec(part, source_type=spec.source_type, source_description=spec.source_description)
            part_geometry = _geometry_for_spec(part_spec)
            start_index = len(template_paths)
            vertex_start = sum(len(mesh.vertices) for mesh in meshes)
            mesh_start = sum(len(mesh.faces) for mesh in meshes)
            template_dx = cursor_x
            template_dy = 0.0
            template_paths.extend(
                [_translate_points(path, template_dx, template_dy) for path in part_geometry.template_paths])
            part_spans.append((part.name, start_index, len(part_geometry.template_paths)))
            mesh_dx, mesh_dy, mesh_dz = _assembly_mesh_translation(part)
            meshes.append(_translate_mesh(part_geometry.mesh, dx=mesh_dx, dy=mesh_dy, dz=mesh_dz))
            mesh_spans.append((part.name, mesh_start, len(part_geometry.mesh.faces)))
            mesh_vertex_spans.append((part.name, vertex_start, len(part_geometry.mesh.vertices)))
            cursor_x += part_geometry.template_width_mm + 20.0
            max_height = max(max_height, part_geometry.template_height_mm)
            max_depth = max(max_depth, cursor_x)
            notes.extend(part_geometry.notes)
        mesh = _combine_meshes(meshes)
        width = max((cursor_x - 20.0), max_depth)
        height = max_height
        return GeometryResult(template_paths, width, height, mesh, list(dict.fromkeys(notes)), False, part_spans,
                              mesh_spans, mesh_vertex_spans)
    return _geometry_for_spec(spec)


def mesh_to_obj(mesh: Mesh) -> str:
    lines = ["# Slab Lab preview mesh"]
    for x, y, z in mesh.vertices:
        lines.append(f"v {x:.4f} {y:.4f} {z:.4f}")
    for a, b, c in mesh.faces:
        lines.append(f"f {a} {b} {c}")
    return "\n".join(lines) + "\n"


def mesh_to_gltf(mesh: Mesh) -> tuple[str, bytes]:
    positions = b"".join(struct.pack("<3f", x, y, z) for x, y, z in mesh.vertices)
    indices = b"".join(struct.pack("<H", i - 1) for face in mesh.faces for i in face)
    pad = lambda data: data + (b"\x00" * ((4 - (len(data) % 4)) % 4))
    positions = pad(positions)
    indices = pad(indices)
    blob = positions + indices
    gltf = {
        "asset": {"version": "2.0", "generator": "Slab Lab App"},
        "buffers": [{"uri": "data:application/octet-stream;base64," + base64.b64encode(blob).decode("ascii"),
                     "byteLength": len(blob)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(positions), "target": 34962},
            {"buffer": 0, "byteOffset": len(positions), "byteLength": len(indices), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(mesh.vertices), "type": "VEC3"},
            {"bufferView": 1, "componentType": 5123, "count": len(mesh.faces) * 3, "type": "SCALAR"},
        ],
        "meshes": [
            {"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}
        ],
        "nodes": [{"mesh": 0}],
        "scenes": [{"nodes": [0]}],
        "scene": 0,
    }
    return "preview.gltf", __import__("json").dumps(gltf, indent=2).encode("utf-8")


def _validate_assembly_geometry(spec: VesselSpec, geometry: GeometryResult, svg_text: str) -> ValidationReport:
    warnings = list(spec.warnings) + list(geometry.notes)
    errors: list[str] = []
    closure_ok = all(path and path[0] == path[-1] for path in geometry.template_paths)
    closure_ok = closure_ok and all(part.height_mm > 0 and part.bottom_diameter_mm > 0 for part in spec.assembly_parts)
    svg_units_ok = 'width="' in svg_text and 'height="' in svg_text and "mm" in svg_text[:200]
    base_perimeter = 0.0
    approximate = geometry.approximate
    for part in spec.assembly_parts:
        part_spec = _part_to_spec(part, source_type=spec.source_type, source_description=spec.source_description)
        part_geometry = GEOMETRY_FACTORY.build(part_spec)
        base_perimeter += GEOMETRY_FACTORY.validate(part_spec, part_geometry, svg_text).base_perimeter_mm
        approximate = approximate or part_geometry.approximate or part.family in {"oval_cylinder", "faceted_star", "scallop_frustum"}
    matched_edges_mm = geometry.template_width_mm
    buildable = all(part.height_mm > 0 and part.bottom_diameter_mm > 0 and part.top_diameter_mm > 0 for part in spec.assembly_parts)
    if approximate:
        warnings.append("Template is approximate and should be confirmed against a physical mockup.")
    valid = buildable and closure_ok and svg_units_ok and not errors
    return ValidationReport(
        valid=valid,
        buildable=buildable,
        closure_ok=closure_ok,
        base_perimeter_mm=base_perimeter,
        matched_edges_mm=matched_edges_mm,
        svg_units_ok=svg_units_ok,
        approximate=approximate,
        warnings=list(dict.fromkeys(warnings)),
        errors=errors,
    )


def validate_geometry(spec: VesselSpec, geometry: GeometryResult, svg_text: str) -> ValidationReport:
    if spec.assembly_parts:
        return _validate_assembly_geometry(spec, geometry, svg_text)
    return GEOMETRY_FACTORY.validate(spec, geometry, svg_text)
