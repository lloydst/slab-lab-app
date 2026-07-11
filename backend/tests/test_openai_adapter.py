import json

from PIL import Image

from slablab.agents import GeminiVisionAnalysisAdapter


class DummyResponse:
    def __init__(self, payload, ok=True, status_code=200, text="ok"):
        self._payload = payload
        self.text = payload.get("text", text)
        self.output_text = payload.get("output_text")
        self.ok = ok
        self.status_code = status_code

    def json(self):
        return self._payload

    def model_dump(self):
        return self._payload


class RetryError(RuntimeError):
    pass


def test_gemini_adapter_parses_json(monkeypatch):
    seen = {}

    class FakeResponses:
        def generate_content(self, **kwargs):
            seen["kwargs"] = kwargs
            return DummyResponse({"text": jsonlib})

    class FakeClient:
        def __init__(self, api_key):
            seen["api_key"] = api_key
            self.models = FakeResponses()

    jsonlib = json.dumps(
        {
            "description": "Tall flared vase with clear bilateral symmetry.",
            "detected_family": "scallop_frustum",
            "confidence": 0.91,
            "symmetry": "bilateral",
            "estimated_height_ratio": 1.8,
            "estimated_top_to_bottom_ratio": 1.3,
            "rim_description": "flared scalloped rim",
            "base_description": "small circular base",
            "detected_features": ["silhouette", "symmetry"],
            "ignored_features": ["glaze", "texture"],
            "warnings": ["low confidence on rim scallops"],
        }
    )

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("slablab.agents.genai.Client", FakeClient)

    adapter = GeminiVisionAnalysisAdapter()
    img = Image.new("RGB", (8, 8), "white")
    import io

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    analysis = adapter.analyze(buf.getvalue(), filename="reference.png")

    assert seen["api_key"] == "test-key"
    assert seen["kwargs"]["model"]
    assert len(seen["kwargs"]["contents"]) == 2
    assert analysis.detected_family == "scallop_frustum"
    assert analysis.rim_description == "flared scalloped rim"


def test_gemini_adapter_default_model_order(monkeypatch):
    monkeypatch.delenv("SLABLAB_GEMINI_MODEL", raising=False)
    monkeypatch.delenv("SLABLAB_GEMINI_MODEL_FALLBACKS", raising=False)

    adapter = GeminiVisionAnalysisAdapter()

    assert adapter._candidate_models() == [
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
    ]


def test_gemini_adapter_retries_transient_errors(monkeypatch):
    calls = {"count": 0}

    class FakeResponses:
        def generate_content(self, **kwargs):
            calls["count"] += 1
            if calls["count"] < 3:
                raise RetryError("503 UNAVAILABLE. This model is currently experiencing high demand.")
            return DummyResponse(
                {
                    "text": json.dumps(
                        {
                            "description": "Tall flared vase with clear bilateral symmetry.",
                            "detected_family": "scallop_frustum",
                            "confidence": 0.91,
                            "symmetry": "bilateral",
                            "estimated_height_ratio": 1.8,
                            "estimated_top_to_bottom_ratio": 1.3,
                            "rim_description": "flared scalloped rim",
                            "base_description": "small circular base",
                            "detected_features": ["silhouette", "symmetry"],
                            "ignored_features": ["glaze", "texture"],
                            "warnings": [],
                        }
                    )
                }
            )

    class FakeClient:
        def __init__(self, api_key):
            self.models = FakeResponses()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("slablab.agents.genai.Client", FakeClient)
    monkeypatch.setattr("slablab.agents.time.sleep", lambda _: None)

    adapter = GeminiVisionAnalysisAdapter()
    img = Image.new("RGB", (8, 8), "white")
    import io

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    analysis = adapter.analyze(buf.getvalue(), filename="reference.png")

    assert calls["count"] == 3
    assert analysis.detected_family == "scallop_frustum"


def test_gemini_adapter_falls_back_on_parse_failure(monkeypatch):
    calls = {"count": 0, "models": []}

    class FakeResponses:
        def generate_content(self, **kwargs):
            calls["count"] += 1
            calls["models"].append(kwargs["model"])
            if calls["count"] == 1:
                return DummyResponse({"text": "not valid json"})
            return DummyResponse(
                {
                    "text": json.dumps(
                        {
                            "description": "Tall flared vase with clear bilateral symmetry.",
                            "detected_family": "scallop_frustum",
                            "confidence": "high",
                            "symmetry": "bilateral",
                            "estimated_height_ratio": 1.8,
                            "estimated_top_to_bottom_ratio": 1.3,
                            "rim_description": "flared scalloped rim",
                            "base_description": "small circular base",
                            "detected_features": ["silhouette", "symmetry"],
                            "ignored_features": ["glaze", "texture"],
                            "warnings": [],
                        }
                    )
                }
            )

    class FakeClient:
        def __init__(self, api_key):
            self.models = FakeResponses()

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("slablab.agents.genai.Client", FakeClient)

    adapter = GeminiVisionAnalysisAdapter()
    img = Image.new("RGB", (8, 8), "white")
    import io

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    analysis = adapter.analyze(buf.getvalue(), filename="reference.png")

    assert calls["count"] == 2
    assert calls["models"][0] == "gemini-3.5-flash"
    assert calls["models"][1] == "gemini-3.1-flash-lite"
    assert analysis.detected_family == "scallop_frustum"
    assert analysis.confidence == 0.85
