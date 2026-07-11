from __future__ import annotations

import io
import json
import math
import os
import re
import logging
import time
from dataclasses import dataclass
from typing import Protocol

from PIL import Image
from google import genai

from .models import AssemblyPart, ImageShapeAnalysis, VesselSpec
from .utils import clamp, count_from_text

FAMILIES = {
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
}

logger = logging.getLogger(__name__)


_NUMBER_WORDS = {
    "one": "1",
    "two": "2",
    "three": "3",
    "four": "4",
    "five": "5",
    "six": "6",
    "seven": "7",
    "eight": "8",
    "nine": "9",
    "ten": "10",
    "eleven": "11",
    "twelve": "12",
    "thirteen": "13",
    "fourteen": "14",
    "fifteen": "15",
}


class VisionAdapter(Protocol):
    def analyze(self, image_bytes: bytes, filename: str | None = None) -> ImageShapeAnalysis: ...


@dataclass
class MockVisionAnalysisAgent:
    def analyze(self, image_bytes: bytes, filename: str | None = None) -> ImageShapeAnalysis:
        with Image.open(io.BytesIO(image_bytes)) as img:
            width, height = img.size
        aspect = width / height if height else 1.0
        symmetry = "bilateral" if 0.9 <= aspect <= 1.1 else ("vertical" if aspect < 1 else "horizontal")
        family = "round_frustum"
        top_to_bottom = clamp(1.0 + abs(math.log(aspect)) * 0.3, 0.75, 1.6)
        if aspect < 0.88:
            family = "scallop_frustum"
        elif aspect > 1.18:
            family = "oval_cylinder"
        description = (
            f"Mock vision analysis for {filename or 'uploaded image'} suggests a {symmetry} vessel "
            f"with a {family.replace('_', ' ')} silhouette, height-to-width ratio around {height / width:.2f}, "
            f"and a top-to-bottom ratio near {top_to_bottom:.2f}."
        )
        warnings = [
            "Mock analysis is based on image dimensions only.",
            "Confirm rim shape, taper, and panel count before generating final geometry.",
        ]
        return ImageShapeAnalysis(
            description=description,
            detected_family=family,
            confidence=0.42,
            symmetry=symmetry,
            estimated_height_ratio=height / width if width else None,
            estimated_top_to_bottom_ratio=top_to_bottom,
            rim_description="uncertain from mock analysis",
            base_description="uncertain from mock analysis",
            detected_features=["silhouette", "symmetry", "proportion"],
            ignored_features=["glaze", "texture", "decoration", "lighting", "reflections", "decals"],
            warnings=warnings,
        )


class GeminiVisionAnalysisAdapter:
    def __init__(self, client: genai.Client | None = None):
        self._client = client

    def _candidate_models(self) -> list[str]:
        configured = os.getenv("SLABLAB_GEMINI_MODEL", "").strip()
        fallbacks = os.getenv("SLABLAB_GEMINI_MODEL_FALLBACKS", "").strip()
        if configured:
            models = [configured]
        else:
            models = ["gemini-3.5-flash"]
        if fallbacks:
            models.extend([item.strip() for item in fallbacks.split(",") if item.strip()])
        else:
            models.append("gemini-3.1-flash-lite")
        return list(dict.fromkeys(models))

    def _prompt(self, filename: str | None) -> str:
        return (
            "Analyze this ceramic vessel reference image and return only a JSON object with these fields: "
            "description, detected_family, confidence, symmetry, estimated_height_ratio, "
            "estimated_top_to_bottom_ratio, rim_description, base_description, detected_features, "
            "ignored_features, warnings. Focus only on silhouette, symmetry, vessel family, proportions, "
            "rim shape, taper, base shape, petals/scallops/facets. Ignore glaze, texture, decoration, "
            "lighting, reflections, and decals. Use geometry-relevant language only. "
            f"Filename: {filename or 'uploaded image'}."
        )

    def _extract_text(self, response: object) -> str:
        output_text = getattr(response, "text", None) or getattr(response, "output_text", None)
        if isinstance(output_text, str) and output_text.strip():
            return output_text
        steps = getattr(response, "steps", None) or []
        chunks: list[str] = []
        for step in steps:
            step_type = getattr(step, "type", None)
            if step_type == "model_output":
                for part in getattr(step, "content", []) or []:
                    text = getattr(part, "text", None)
                    if text:
                        chunks.append(text)
        return "\n".join(chunks).strip()

    def _parse_payload(self, text: str) -> ImageShapeAnalysis:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start: end + 1]
        payload = json.loads(cleaned)
        confidence = payload.get("confidence")
        if isinstance(confidence, str):
            payload["confidence"] = self._coerce_confidence(confidence)
        for key in ("estimated_height_ratio", "estimated_top_to_bottom_ratio"):
            value = payload.get(key)
            if isinstance(value, str):
                payload[key] = self._coerce_ratio(value)
        for key in ("warnings", "detected_features", "ignored_features"):
            value = payload.get(key)
            if isinstance(value, str):
                payload[key] = [value]
        return ImageShapeAnalysis.model_validate(payload)

    def _coerce_ratio(self, value: str) -> float | None:
        text = value.strip().lower().replace("×", "x")
        if ":" in text:
            left, right = text.split(":", 1)
            try:
                return float(left.strip()) / float(right.strip())
            except Exception:
                return None
        if "to" in text:
            left, right = text.split("to", 1)
            try:
                return float(left.strip()) / float(right.strip())
            except Exception:
                return None
        match = re.search(r"(\d+(?:\.\d+)?)", text)
        if match:
            try:
                return float(match.group(1))
            except Exception:
                return None
        return None

    @staticmethod
    def _coerce_confidence(value: str) -> float:
        text = value.strip().lower()
        if text in {"high", "strong"}:
            return 0.85
        if text in {"medium", "moderate"}:
            return 0.6
        if text in {"low", "weak"}:
            return 0.35
        if text.endswith("%"):
            try:
                return max(0.0, min(1.0, float(text.rstrip("%")) / 100.0))
            except Exception:
                return 0.5
        try:
            numeric = float(text)
        except Exception:
            return 0.5
        return numeric if numeric <= 1.0 else max(0.0, min(1.0, numeric / 100.0))

    def _should_retry(self, exc: Exception) -> bool:
        message = str(exc).lower()
        return (
                "503" in message
                or "unavailable" in message
                or "high demand" in message
                or "rate" in message
                or "quota" in message
                or "resource_exhausted" in message
                or "429" in message
        )

    def _call_model(self, client: genai.Client, model: str, prompt: str, image: Image.Image) -> object:
        return client.models.generate_content(
            model=model,
            contents=[prompt, image],
            config={"response_mime_type": "application/json"},
        )

    def analyze(self, image_bytes: bytes, filename: str | None = None) -> ImageShapeAnalysis:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set.")
        image_mime = "image/jpeg"
        if filename:
            lowered = filename.lower()
            if lowered.endswith(".png"):
                image_mime = "image/png"
            elif lowered.endswith(".webp"):
                image_mime = "image/webp"
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        models = self._candidate_models()
        client = self._client or genai.Client(api_key=api_key)
        prompt = self._prompt(filename)
        attempts = 3
        last_exc: Exception | None = None
        for model in models:
            logger.info("gemini_vision_request model=%s filename=%s size=%sx%s mime=%s", model, filename or "",
                        image.width, image.height, image_mime)
            for attempt in range(1, attempts + 1):
                try:
                    response = self._call_model(client, model, prompt, image)
                    if attempt > 1 or model != models[0]:
                        logger.info("gemini_vision_retry_success model=%s attempt=%s", model, attempt)
                    analysis_text = self._extract_text(response)
                    if not analysis_text:
                        raise RuntimeError("Gemini vision response did not contain any text output.")
                    logger.info("gemini_vision_response received_text=%s chars", len(analysis_text))
                    try:
                        return self._parse_payload(analysis_text)
                    except Exception as parse_exc:
                        last_exc = parse_exc
                        logger.warning("gemini_vision_parse_failed model=%s reason=%s", model, parse_exc)
                        break
                except Exception as exc:
                    last_exc = exc
                    transient = self._should_retry(exc)
                    if not transient:
                        logger.warning("gemini_vision_model_failed model=%s reason=%s", model, exc)
                        break
                    if attempt == attempts:
                        logger.warning("gemini_vision_model_exhausted model=%s reason=%s", model, exc)
                        break
                    delay = 0.75 * (2 ** (attempt - 1))
                    logger.warning("gemini_vision_retry model=%s attempt=%s delay=%.2fs reason=%s", model, attempt,
                                   delay, exc)
                    time.sleep(delay)
        raise RuntimeError(f"Gemini vision request failed: {last_exc}")


def image_to_description_tool(image_analysis: ImageShapeAnalysis) -> str:
    parts = [image_analysis.description]
    if image_analysis.rim_description:
        parts.append(f"Rim: {image_analysis.rim_description}.")
    if image_analysis.base_description:
        parts.append(f"Base: {image_analysis.base_description}.")
    if image_analysis.warnings:
        parts.append("Warnings: " + "; ".join(image_analysis.warnings))
    return " ".join(parts)


def _parse_dimension(text: str, key: str, default: float) -> float:
    pattern = rf"{key}\s*[:=]\s*(\d+(?:\.\d+)?)"
    match = re.search(pattern, text, flags=re.I)
    if match:
        return float(match.group(1))
    return default


def _build_assembly_parts(spec: VesselSpec, lowered: str) -> list[AssemblyPart]:
    parts: list[AssemblyPart] = []
    if "lidded" in lowered or "lid" in lowered or "pot" in lowered:
        lid_height = max(8.0, spec.height_mm * 0.18)
        lid_family = "round_lid"
        if "polygon" in lowered or "hex" in lowered or "square" in lowered or "facet" in lowered:
            lid_family = "polygon_lid"
        elif "oval" in lowered or "ellipt" in lowered:
            lid_family = "oval_lid"
        parts.append(
            AssemblyPart(
                name="body",
                family=spec.family,
                height_mm=spec.height_mm,
                bottom_diameter_mm=spec.bottom_diameter_mm,
                top_diameter_mm=spec.top_diameter_mm,
                sides=spec.sides,
                scallops=spec.scallops,
                scallop_depth_mm=spec.scallop_depth_mm,
                oval_major_mm=spec.oval_major_mm,
                oval_minor_mm=spec.oval_minor_mm,
                facets=spec.facets,
                ripple_mm=spec.ripple_mm,
                offset_z_mm=0.0,
            )
        )
        parts.append(
            AssemblyPart(
                name="lid",
                family=lid_family,
                height_mm=lid_height,
                bottom_diameter_mm=spec.bottom_diameter_mm,
                top_diameter_mm=spec.bottom_diameter_mm,
                sides=spec.sides or 6,
                scallops=spec.scallops,
                scallop_depth_mm=spec.scallop_depth_mm,
                oval_major_mm=spec.oval_major_mm,
                oval_minor_mm=spec.oval_minor_mm,
                facets=spec.facets,
                ripple_mm=spec.ripple_mm,
                offset_x_mm=spec.bottom_diameter_mm + 20.0,
                offset_z_mm=spec.height_mm,
                notes=["Separate lid part"],
            )
        )
        if "finial" in lowered or "knob" in lowered or "conical" in lowered:
            parts.append(
                AssemblyPart(
                    name="finial",
                    family="faceted_star",
                    height_mm=max(18.0, spec.height_mm * 0.12),
                    bottom_diameter_mm=max(10.0, spec.top_diameter_mm * 0.18),
                    top_diameter_mm=max(10.0, spec.top_diameter_mm * 0.12),
                    facets=6,
                    offset_x_mm=spec.bottom_diameter_mm + 20.0,
                    offset_z_mm=spec.height_mm + lid_height,
                    notes=["Separate finial part"],
                )
            )
    if "spout" in lowered:
        spout_height = max(18.0, spec.height_mm * 0.22)
        parts.append(
            AssemblyPart(
                name="spout",
                family="tapered_polygon",
                height_mm=spout_height,
                bottom_diameter_mm=max(12.0, spec.bottom_diameter_mm * 0.18),
                top_diameter_mm=max(18.0, spec.bottom_diameter_mm * 0.28),
                sides=4,
                offset_x_mm=spec.bottom_diameter_mm * 2 + 28.0,
                offset_z_mm=spec.height_mm * 0.55,
                notes=["Separate spout part"],
            )
        )
    if "foot ring" in lowered or "footring" in lowered:
        parts.append(
            AssemblyPart(
                name="foot_ring",
                family="polygon_prism",
                height_mm=max(6.0, spec.height_mm * 0.08),
                bottom_diameter_mm=max(20.0, spec.bottom_diameter_mm * 0.55),
                top_diameter_mm=max(20.0, spec.bottom_diameter_mm * 0.55),
                sides=6,
                offset_x_mm=spec.bottom_diameter_mm * 2 + 40.0,
                offset_z_mm=0.0,
                notes=["Separate foot ring part"],
            )
        )
    if "collar" in lowered or "neck" in lowered:
        parts.append(
            AssemblyPart(
                name="collar",
                family="round_frustum",
                height_mm=max(10.0, spec.height_mm * 0.12),
                bottom_diameter_mm=max(16.0, spec.top_diameter_mm * 0.4),
                top_diameter_mm=max(18.0, spec.top_diameter_mm * 0.55),
                offset_x_mm=spec.bottom_diameter_mm * 2 + 56.0,
                offset_z_mm=spec.height_mm * 0.78,
                notes=["Separate collar part"],
            )
        )
    if "handle" in lowered:
        handle_width = max(16.0, spec.bottom_diameter_mm * 0.22)
        handle_height = max(40.0, spec.height_mm * 0.55)
        parts.append(
            AssemblyPart(
                name="handle_blank",
                family="polygon_prism",
                height_mm=handle_height,
                bottom_diameter_mm=handle_width,
                top_diameter_mm=handle_width,
                sides=4,
                offset_x_mm=spec.bottom_diameter_mm * 2 + 40.0,
                offset_z_mm=spec.height_mm * 0.45,
                notes=["Handle blank is a simplified slab strip placeholder"],
            )
        )
    return parts


def _normalize_number_words(text: str) -> str:
    normalized = text
    for word, digit in _NUMBER_WORDS.items():
        normalized = re.sub(rf"\b{word}\b", digit, normalized, flags=re.I)
    return normalized


def _extract_dimension_triplet(text: str) -> list[float]:
    normalized = _normalize_number_words(text.lower())
    numbers = [float(value) for value in re.findall(r"\b\d+(?:\.\d+)?\b", normalized)]
    if re.search(r"\b(cube|by|x|×)\b", normalized, flags=re.I):
        return numbers[:3]
    return numbers


def _family_from_text(text: str) -> tuple[str, dict[str, float | int | None], list[str]]:
    lowered = text.lower()
    warnings: list[str] = []
    sides = count_from_text(lowered)
    if "cube" in lowered:
        return "cube", {}, warnings
    if "lidded pot" in lowered or "lidded vessel" in lowered or "pot with a lid" in lowered:
        return "round_frustum", {}, warnings
    if "box" in lowered or "container" in lowered or "lidded" in lowered:
        return "slab_box", {"sides": 4}, warnings
    if "tray" in lowered or "platter" in lowered or "dish" in lowered:
        return "slab_tray", {"sides": 4}, warnings
    if "hex" in lowered:
        return "polygon_prism", {"sides": 6}, warnings
    if "square" in lowered:
        return "tapered_polygon", {"sides": 4}, warnings
    if "star" in lowered or "faceted" in lowered or "art deco" in lowered:
        facets = count_from_text(lowered) or 8
        return "faceted_star", {"facets": facets}, warnings
    if "oval" in lowered or "elliptical" in lowered or "ellipse" in lowered:
        return "oval_cylinder", {"oval_major_mm": None, "oval_minor_mm": None}, warnings
    if "petal" in lowered or "scallop" in lowered or "tulip" in lowered or "flower" in lowered:
        scallops = count_from_text(lowered) or 6
        return "scallop_frustum", {"scallops": scallops}, warnings
    if "polygon" in lowered or "sided" in lowered:
        return "polygon_prism", {"sides": sides or 6}, warnings
    if "taper" in lowered or "frustum" in lowered or "flared" in lowered:
        return "tapered_polygon", {"sides": sides or 4}, warnings
    warnings.append("Defaulted to round frustum because the description was ambiguous.")
    return "round_frustum", {}, warnings


def parse_description_tool(description: str, source_type: str = "text") -> VesselSpec:
    family, extras, warnings = _family_from_text(description)
    lowered = description.lower()
    dimensions = _extract_dimension_triplet(lowered)
    height = _parse_dimension(lowered, "height_mm", 120.0)
    side_hint = _parse_dimension(lowered, "side_mm", 80.0)
    if dimensions:
        if family in {"slab_box", "slab_tray"}:
            if len(dimensions) >= 1:
                side_hint = dimensions[0]
            if len(dimensions) >= 2:
                height = dimensions[2] if len(dimensions) >= 3 else dimensions[-1]
                if len(dimensions) == 2:
                    height = dimensions[1]
            if len(dimensions) >= 3:
                height = dimensions[2]
        elif family in {"polygon_prism", "tapered_polygon", "round_frustum", "scallop_frustum", "oval_cylinder", "faceted_star"}:
            height = dimensions[0]
    if "tall" in lowered:
        height = max(height, 180.0)
    if "cup" in lowered:
        height = max(height, 80.0)
    bottom = _parse_dimension(lowered, "bottom_diameter_mm", side_hint if family in {"slab_box", "slab_tray", "cube"} else 70.0)
    top = _parse_dimension(lowered, "top_diameter_mm", side_hint if family in {"slab_box", "slab_tray", "cube"} else 90.0)
    if family == "cube":
        edge = dimensions[0] if dimensions else side_hint
        if len(dimensions) >= 3 and len({round(value, 6) for value in dimensions[:3]}) > 1:
            warnings.append("Cube dimensions were not equal; using the first value as the edge length.")
        height = bottom = top = edge
    if family in {"slab_box", "slab_tray"} and dimensions:
        bottom = top = side_hint
        if len(dimensions) >= 2 and "by" not in lowered and "x" not in lowered:
            height = dimensions[1]
        elif len(dimensions) >= 2 and height == 120.0:
            height = dimensions[-1]
    if "lidded pot" in lowered or "wide overhanging lid" in lowered or "finial" in lowered or "knob" in lowered:
        family = "round_frustum"
    if family == "cube":
        edge = dimensions[0] if dimensions else side_hint
        spec = VesselSpec(
            name="Parsed cube",
            family=family,
            height_mm=edge,
            bottom_diameter_mm=edge,
            top_diameter_mm=edge,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.92,
            warnings=warnings,
        )
        return spec
    if family == "polygon_prism":
        bottom = top = _parse_dimension(lowered, "diameter_mm", 75.0)
        sides = int(extras.get("sides") or 6)
        top = bottom
        spec = VesselSpec(
            name="Parsed polygon prism",
            family=family,
            height_mm=height,
            bottom_diameter_mm=bottom,
            top_diameter_mm=top,
            sides=sides,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.9,
            warnings=warnings,
        )
        return spec
    if family == "tapered_polygon":
        sides = int(extras.get("sides") or 4)
        if "narrow at the base" in lowered or "narrow base" in lowered:
            bottom = min(bottom, 60.0)
            top = max(top, 90.0)
        spec = VesselSpec(
            name="Parsed tapered polygon",
            family=family,
            height_mm=height,
            bottom_diameter_mm=bottom,
            top_diameter_mm=top,
            sides=sides,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.86,
            warnings=warnings,
        )
        return spec
    if family == "round_frustum":
        bottom = _parse_dimension(lowered, "bottom_diameter_mm", 72.0)
        top = _parse_dimension(lowered, "top_diameter_mm", 96.0)
        if "flare" in lowered:
            top = max(top, bottom * 1.25)
        spec = VesselSpec(
            name="Parsed round frustum",
            family=family,
            height_mm=height,
            bottom_diameter_mm=bottom,
            top_diameter_mm=top,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.82,
            warnings=warnings,
        )
        if "lidded" in lowered or "lid" in lowered or "handle" in lowered or "finial" in lowered or "knob" in lowered:
            spec.assembly_parts = _build_assembly_parts(spec, lowered)
            if spec.assembly_parts:
                spec.warnings.append("Assembly parts were inferred from the description.")
        return spec
    if family == "scallop_frustum":
        scallops = int(extras.get("scallops") or 6)
        if "twelve" in lowered or "12" in lowered:
            scallops = 12
        spec = VesselSpec(
            name="Parsed scallop frustum",
            family=family,
            height_mm=height,
            bottom_diameter_mm=70.0,
            top_diameter_mm=110.0 if "flared" in lowered else 96.0,
            scallops=scallops,
            scallop_depth_mm=10.0 if scallops >= 8 else 7.0,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.83,
            warnings=warnings,
        )
        if "lidded" in lowered or "lid" in lowered or "handle" in lowered:
            spec.assembly_parts = _build_assembly_parts(spec, lowered)
            if spec.assembly_parts:
                spec.warnings.append("Assembly parts were inferred from the description.")
        return spec
    if family == "oval_cylinder":
        major = _parse_dimension(lowered, "oval_major_mm", 120.0)
        minor = _parse_dimension(lowered, "oval_minor_mm", 82.0)
        if "soft" in lowered:
            major = max(major, 110.0)
        spec = VesselSpec(
            name="Parsed oval cylinder",
            family=family,
            height_mm=height,
            bottom_diameter_mm=minor,
            top_diameter_mm=major,
            oval_major_mm=major,
            oval_minor_mm=minor,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.8,
            warnings=warnings + ["Oval footprint is clay-practical approximate."],
        )
        if "lidded" in lowered or "lid" in lowered or "handle" in lowered:
            spec.assembly_parts = _build_assembly_parts(spec, lowered)
            if spec.assembly_parts:
                spec.warnings.append("Assembly parts were inferred from the description.")
        return spec
    if family == "slab_box":
        side = _parse_dimension(lowered, "side_mm", side_hint)
        if "small" in lowered:
            side = min(side, 70.0)
        if "large" in lowered:
            side = max(side, 120.0)
        if not dimensions:
            height = _parse_dimension(lowered, "height_mm", 90.0)
        if "tall" in lowered:
            height = max(height, 100.0)
        spec = VesselSpec(
            name="Parsed slab box",
            family=family,
            height_mm=height,
            bottom_diameter_mm=side,
            top_diameter_mm=side,
            sides=4,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.81,
            warnings=warnings,
        )
        spec.assembly_parts = _build_assembly_parts(spec, lowered)
        if spec.assembly_parts:
            spec.warnings.append("Assembly parts were inferred from the description.")
        return spec
    if family == "slab_tray":
        side = _parse_dimension(lowered, "side_mm", side_hint if dimensions else 120.0)
        if not dimensions:
            if "shallow" in lowered:
                height = _parse_dimension(lowered, "height_mm", 22.0)
            else:
                height = _parse_dimension(lowered, "height_mm", 35.0)
        if "large" in lowered:
            side = max(side, 160.0)
        spec = VesselSpec(
            name="Parsed slab tray",
            family=family,
            height_mm=height,
            bottom_diameter_mm=side,
            top_diameter_mm=side,
            sides=4,
            shrinkage_percent=0,
            source_type=source_type,  # type: ignore[arg-type]
            source_description=description,
            confidence=0.8,
            warnings=warnings,
        )
        if "lidded" in lowered or "lid" in lowered or "handle" in lowered:
            spec.assembly_parts = _build_assembly_parts(spec, lowered)
            if spec.assembly_parts:
                spec.warnings.append("Assembly parts were inferred from the description.")
        return spec
    facets = int(extras.get("facets") or 8)
    spec = VesselSpec(
        name="Parsed faceted star",
        family="faceted_star",
        height_mm=height,
        bottom_diameter_mm=72.0,
        top_diameter_mm=72.0,
        facets=facets,
        ripple_mm=8.0,
        shrinkage_percent=0,
        source_type=source_type,  # type: ignore[arg-type]
        source_description=description,
        confidence=0.79,
        warnings=warnings,
    )
    if "lidded" in lowered or "lid" in lowered or "handle" in lowered:
        spec.assembly_parts = _build_assembly_parts(spec, lowered)
        if spec.assembly_parts:
            spec.warnings.append("Assembly parts were inferred from the description.")
    return spec


@dataclass
class PlannerAgent:
    def plan(self, spec: VesselSpec) -> list[str]:
        chain = ["ShapeSpecAgent", "GeometryAgent", "TemplateUnfolderTool", "ValidationAgent", "ExportAgent"]
        if spec.source_type == "image":
            chain.insert(0, "VisionAnalysisAgent")
        return chain


class ShapeSpecAgent:
    def from_description(self, description: str, source_type: str = "text") -> VesselSpec:
        return parse_description_tool(description, source_type=source_type)

    def from_analysis(self, analysis: ImageShapeAnalysis) -> VesselSpec:
        spec = parse_description_tool(analysis.description, source_type="image")
        if analysis.detected_family in FAMILIES:
            spec.family = analysis.detected_family  # type: ignore[assignment]
        spec.confidence = analysis.confidence
        spec.warnings = list(dict.fromkeys(spec.warnings + analysis.warnings))
        spec.source_description = analysis.description
        return spec
