import math

from slablab.agents import ShapeSpecAgent
from slablab.exports import generate_template_svg_tool
from slablab.geometry import generate_geometry, validate_geometry


def _spec(description: str):
    return ShapeSpecAgent().from_description(description)


def test_each_geometry_family_builds():
    descriptions = [
        "A straight hexagonal cup with six equal sides and a clean geometric base.",
        "A flower cup with six rounded petals and a flared tulip-like rim.",
        "A modern tapered square cup, narrow at the base and wider at the top.",
        "An oval cup with a soft elliptical footprint and simple smooth sides.",
        "An eight point star cup with faceted art deco grooves around the wall.",
        "A tall twelve-petal tulip vase that flares outward.",
        "A cube ten by 10 by 10.",
        "A square slab box with crisp walls and a fitted lid.",
        "A shallow ceramic tray with flat sides and a clean rectangular footprint.",
        "A lidded slab box with crisp walls and a fitted lid.",
    ]
    for description in descriptions:
        spec = _spec(description)
        geometry = generate_geometry(spec)
        svg = generate_template_svg_tool(spec, geometry)
        report = validate_geometry(spec, geometry, svg)
        assert geometry.mesh.vertices
        assert geometry.mesh.faces
        assert geometry.template_paths
        if spec.family == "cube":
            assert len(geometry.template_paths) == 6
        assert report.base_perimeter_mm > 0
        assert "mm" in svg


def test_svg_uses_millimeter_units():
    spec = _spec("A straight hexagonal cup with six equal sides and a clean geometric base.")
    geometry = generate_geometry(spec)
    svg = generate_template_svg_tool(spec, geometry)
    assert 'width="' in svg and 'height="' in svg
    assert "mm" in svg.splitlines()[0]


def test_base_perimeter_validation_for_polygon():
    spec = _spec("A straight hexagonal cup with six equal sides and a clean geometric base.")
    geometry = generate_geometry(spec)
    report = validate_geometry(spec, geometry, generate_template_svg_tool(spec, geometry))
    expected = 2 * spec.sides * (spec.bottom_diameter_mm / 2) * math.sin(math.pi / spec.sides)
    assert abs(report.base_perimeter_mm - expected) < 1e-6
    assert report.closure_ok
