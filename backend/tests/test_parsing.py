from slablab.agents import MockVisionAnalysisAgent, ShapeSpecAgent, image_to_description_tool
from PIL import Image
from io import BytesIO


EXAMPLES = [
    (
        "A straight hexagonal cup with six equal sides and a clean geometric base.",
        "polygon_prism",
        {"sides": 6},
    ),
    (
        "A flower cup with six rounded petals and a flared tulip-like rim.",
        "scallop_frustum",
        {"scallops": 6},
    ),
    (
        "A modern tapered square cup, narrow at the base and wider at the top.",
        "tapered_polygon",
        {"sides": 4},
    ),
    (
        "An oval cup with a soft elliptical footprint and simple smooth sides.",
        "oval_cylinder",
        {},
    ),
    (
        "An eight point star cup with faceted art deco grooves around the wall.",
        "faceted_star",
        {"facets": 8},
    ),
    (
        "A tall twelve-petal tulip vase that flares outward.",
        "scallop_frustum",
        {"scallops": 12},
    ),
    (
        "A square slab box with crisp walls and a fitted lid.",
        "slab_box",
        {"sides": 4},
    ),
    (
        "A shallow ceramic tray with flat sides and a clean rectangular footprint.",
        "slab_tray",
        {"sides": 4},
    ),
]


def test_required_examples_parse_to_expected_families():
    agent = ShapeSpecAgent()
    for description, family, expectations in EXAMPLES:
        spec = agent.from_description(description)
        assert spec.family == family
        for key, value in expectations.items():
            assert getattr(spec, key) == value


def test_lidded_box_infers_assembly_parts():
    spec = ShapeSpecAgent().from_description("A lidded slab box with crisp walls and a fitted lid.")
    assert spec.family == "slab_box"
    assert len(spec.assembly_parts) >= 2
    assert {part.name for part in spec.assembly_parts} >= {"body", "lid"}


def test_cube_parses_as_cube_family():
    spec = ShapeSpecAgent().from_description("a cube ten by 10 by 10")
    assert spec.family == "cube"
    assert spec.height_mm == 10
    assert spec.bottom_diameter_mm == 10
    assert spec.top_diameter_mm == 10


def test_lidded_pot_infers_assembly_parts():
    description = (
        "A lidded pot with a flared, concave-tapering body, a wide overhanging lid, "
        "and a prominent conical finial/knob. Rim: Hidden/contained; the vessel profile is defined by the lid's wide, "
        "slightly drooping rim edge which sits flush on the pot shoulder. Base: Flat, circular base with a slight inward taper "
        "at the lower section of the body. Warnings: The vessel is a two-part assembly (pot and lid); proportions are based on the combined silhouette."
    )
    spec = ShapeSpecAgent().from_description(description)
    assert spec.family == "round_frustum"
    assert len(spec.assembly_parts) >= 3
    assert {part.name for part in spec.assembly_parts} >= {"body", "lid", "finial"}
    lid = next(part for part in spec.assembly_parts if part.name == "lid")
    assert lid.family in {"round_lid", "polygon_lid", "oval_lid"}


def test_cube_phrase_parses_to_cube():
    spec = ShapeSpecAgent().from_description('a cube ten , by 10 by 10')
    assert spec.family == "cube"
    assert spec.bottom_diameter_mm == 10
    assert spec.top_diameter_mm == 10
    assert spec.height_mm == 10


def test_mock_image_analysis_generates_description():
    image = Image.new("RGB", (400, 600), "white")
    buf = BytesIO()
    image.save(buf, format="PNG")
    analysis = MockVisionAnalysisAgent().analyze(buf.getvalue(), filename="test.png")
    description = image_to_description_tool(analysis)
    assert analysis.detected_family in {"round_frustum", "scallop_frustum", "oval_cylinder"}
    assert analysis.confidence < 1
    assert "glaze" in analysis.ignored_features
    assert "Mock vision analysis" in description
