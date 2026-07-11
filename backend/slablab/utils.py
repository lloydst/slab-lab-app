from __future__ import annotations

import math
import re
from pathlib import Path


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def mm(value: float) -> str:
    return f"{value:.2f}mm"


_NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
}


def count_from_text(text: str) -> int | None:
    lowered = text.lower()
    for word, value in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", lowered):
            return value
    match = re.search(r"\b(\d{1,2})\b", lowered)
    if match:
        return int(match.group(1))
    return None


def ellipse_circumference(a: float, b: float) -> float:
    # Ramanujan's second approximation.
    h = ((a - b) ** 2) / ((a + b) ** 2)
    return math.pi * (a + b) * (1 + (3 * h) / (10 + math.sqrt(4 - 3 * h)))


def regular_polygon_perimeter(sides: int, radius: float) -> float:
    return 2 * sides * radius * math.sin(math.pi / sides)


def regular_polygon_points(sides: int, radius: float, cx: float = 0, cy: float = 0) -> list[tuple[float, float]]:
    return [
        (
            cx + radius * math.cos((2 * math.pi * i / sides) - math.pi / 2),
            cy + radius * math.sin((2 * math.pi * i / sides) - math.pi / 2),
        )
        for i in range(sides)
    ]
