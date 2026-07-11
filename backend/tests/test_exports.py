import json
import re
import xml.etree.ElementTree as ET
import zipfile

from slablab.agents import ShapeSpecAgent
from slablab.exports import export_bundle_tool, generate_template_svg_tool, geometry_to_files
from slablab.geometry import GeometryResult, Mesh, generate_geometry, validate_geometry
from slablab.models import AssemblyPart, VesselSpec


def test_zip_export_contains_expected_files():
    spec = ShapeSpecAgent().from_description("A modern tapered square cup, narrow at the base and wider at the top.")
    geometry = generate_geometry(spec)
    svg = generate_template_svg_tool(spec, geometry)
    validation = validate_geometry(spec, geometry, svg)
    files = geometry_to_files(spec, geometry, validation)
    bundle = export_bundle_tool(files)
    with zipfile.ZipFile(__import__("io").BytesIO(bundle)) as zf:
        names = set(zf.namelist())
    assert {"spec.json", "validation.json", "template.svg", "preview.obj", "preview.gltf", "template.pdf"} <= names


def test_template_svg_keeps_text_inside_canvas():
    spec = VesselSpec(
        name="an intentionally very long vessel name that should not spill beyond the SVG edge",
        family="slab_box",
        height_mm=60,
        bottom_diameter_mm=40,
        top_diameter_mm=40,
        source_type="text",
        source_description="regression test",
        assembly_parts=[
            AssemblyPart(
                name=f"an intentionally very long assembly part label {index} that should be truncated",
                family="slab_box",
                height_mm=60,
                bottom_diameter_mm=40,
                top_diameter_mm=40,
            )
            for index in range(1, 13)
        ],
    )
    geometry = GeometryResult(
        template_paths=[
            [(0.0, 0.0), (120.0, 0.0), (120.0, 40.0), (0.0, 40.0), (0.0, 0.0)]
            for _ in range(12)
        ],
        template_width_mm=120.0,
        template_height_mm=40.0,
        mesh=Mesh(vertices=[], faces=[]),
        notes=[],
        approximate=False,
        part_spans=[(part.name, index, 1) for index, part in enumerate(spec.assembly_parts)],
    )
    svg = generate_template_svg_tool(spec, geometry)
    root = ET.fromstring(svg)
    width = float(root.attrib["viewBox"].split()[2])
    path_max_x = 0.0
    for path in root.findall(".//{http://www.w3.org/2000/svg}path"):
        numbers = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", path.attrib["d"])]
        xs = numbers[0::2]
        assert xs
        path_max_x = max(path_max_x, max(xs))
        assert max(xs) <= width
    text_nodes = root.findall(".//{http://www.w3.org/2000/svg}text")
    text_xs = [float(node.attrib["x"]) for node in text_nodes]
    assert len(text_nodes) == 13
    assert text_xs[0] < path_max_x
    assert len({round(x, 2) for x in text_xs[1:]}) == 1
    assert min(text_xs[1:]) > path_max_x
    assert svg.count("<tspan") >= 2
    assert "..." in svg
    assert float(re.search(r'width="([0-9.]+)mm"', svg).group(1)) > geometry.template_width_mm


def test_template_svg_paths_stay_inside_canvas():
    spec = VesselSpec(
        name="round frustum regression",
        family="round_frustum",
        height_mm=80,
        bottom_diameter_mm=70,
        top_diameter_mm=40,
        source_type="text",
        source_description="regression test",
    )
    geometry = generate_geometry(spec)
    svg = generate_template_svg_tool(spec, geometry)
    root = ET.fromstring(svg)
    width = float(root.attrib["viewBox"].split()[2])
    height = float(root.attrib["viewBox"].split()[3])
    bboxes = []
    for path in root.findall(".//{http://www.w3.org/2000/svg}path"):
        numbers = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", path.attrib["d"])]
        xs = numbers[0::2]
        ys = numbers[1::2]
        assert xs and ys
        assert min(xs) >= 0
        assert min(ys) >= 0
        assert max(xs) <= width
        assert max(ys) <= height
        bboxes.append((min(xs), min(ys), max(xs), max(ys)))
    assert len(bboxes) >= 2
    for index, first in enumerate(bboxes):
        for second in bboxes[index + 1 :]:
            separated = (
                first[2] <= second[0]
                or second[2] <= first[0]
                or first[3] <= second[1]
                or second[3] <= first[1]
            )
            assert separated


def test_template_svg_respects_assembly_part_heights():
    spec = VesselSpec(
        name="assembly height regression",
        family="slab_box",
        height_mm=100,
        bottom_diameter_mm=40,
        top_diameter_mm=40,
        source_type="text",
        source_description="regression test",
        assembly_parts=[
            AssemblyPart(
                name="short part",
                family="slab_box",
                height_mm=20,
                bottom_diameter_mm=40,
                top_diameter_mm=40,
            ),
            AssemblyPart(
                name="tall part",
                family="slab_box",
                height_mm=80,
                bottom_diameter_mm=40,
                top_diameter_mm=40,
            ),
        ],
    )
    geometry = GeometryResult(
        template_paths=[
            [(0.0, 0.0), (40.0, 0.0), (40.0, 20.0), (0.0, 20.0), (0.0, 0.0)],
            [(0.0, 0.0), (40.0, 0.0), (40.0, 80.0), (0.0, 80.0), (0.0, 0.0)],
        ],
        template_width_mm=40.0,
        template_height_mm=80.0,
        mesh=Mesh(vertices=[], faces=[]),
        notes=[],
        approximate=False,
        part_spans=[(part.name, index, 1) for index, part in enumerate(spec.assembly_parts)],
    )
    svg = generate_template_svg_tool(spec, geometry)
    root = ET.fromstring(svg)
    paths = root.findall(".//{http://www.w3.org/2000/svg}path")
    assert len(paths) == 2
    first_numbers = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", paths[0].attrib["d"])]
    second_numbers = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", paths[1].attrib["d"])]
    first_bbox = (
        min(first_numbers[0::2]),
        min(first_numbers[1::2]),
        max(first_numbers[0::2]),
        max(first_numbers[1::2]),
    )
    second_bbox = (
        min(second_numbers[0::2]),
        min(second_numbers[1::2]),
        max(second_numbers[0::2]),
        max(second_numbers[1::2]),
    )
    assert round(first_bbox[3] - first_bbox[1], 2) == 20.0
    assert round(second_bbox[3] - second_bbox[1], 2) == 80.0
    assert round(second_bbox[1], 2) == round(first_bbox[1], 2)
