import json
import re
from pathlib import Path

import pytest

from colors import DEFAULT_COLORS
from handler import RequestValidationError, parse_arguments
from parse_sentences import split_into_sentence_lengths, split_into_sentences
from quality import MIN_SEGMENT_COUNT, TOO_SIMPLE_MESSAGE
from svg_simple import plot_lengths as plot_simple_lengths
from svg_split import get_sentences, plot_lengths as plot_split_lengths


CONTRACT_PATH = (
    Path(__file__).resolve().parents[2] / "contract" / "word-art-contract.json"
)
CONTRACT = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def payload_for(kind, segment_count):
    if kind == "simple":
        return {"simple_path": plot_simple_lengths([1] * segment_count)}
    if kind == "split":
        return {
            "split": {"words": ["highlight"], "color": None},
            "split_pre_parsed": [
                {"color": "#14B6D4", "length": 1}
                for _ in range(segment_count)
            ],
        }
    if kind == "fallback":
        return {"text": ".".join(f"sentence {index}" for index in range(segment_count))}
    raise AssertionError(f"Unknown payload kind: {kind}")


def direction_sign(value):
    if abs(value) < 1e-9:
        return 0
    return 1 if value > 0 else -1


def flattened_split_segments(path_groups):
    flattened = []
    for group in path_groups:
        for segment in group["path"]:
            delta = segment.end - segment.start
            flattened.append(
                {
                    "color": group["color"],
                    "length": segment.length(),
                    "direction": [
                        direction_sign(delta.real),
                        direction_sign(delta.imag),
                    ],
                }
            )
    return flattened


def test_contract_loads_supported_version_and_required_sections():
    assert CONTRACT["schema"] == "word-art-contract"
    assert CONTRACT["version"] == 1
    assert {
        "palette",
        "quality",
        "request",
        "sentence_parsing",
        "turtle_path",
        "external_boundaries",
    }.issubset(CONTRACT)


def test_request_defaults_and_null_semantics_match_handler_validation():
    defaults = CONTRACT["request"]["defaults"]
    fields = CONTRACT["request"]["fields"]
    assert DEFAULT_COLORS == {
        "bg_color": defaults["bg_color"],
        "color": defaults["color"],
        "node_colors": defaults["node_color"],
        "split_color": defaults["split_color"],
    }
    assert fields["color"]["nullable"] is False
    assert fields["bg_color"]["nullable"] is False

    simple_path = plot_simple_lengths([1] * CONTRACT["quality"]["minimum_segment_count"])
    parsed = parse_arguments(json.dumps({"simple_path": simple_path}))
    assert parsed["color"] == defaults["color"]
    assert parsed["bg_color"] == defaults["bg_color"]
    assert parsed["node_colors"] is None

    parsed_with_nulls = parse_arguments(
        json.dumps(
            {
                "split": {"words": ["highlight"], "color": None},
                "split_pre_parsed": [
                    {"color": defaults["color"], "length": 1}
                    for _ in range(CONTRACT["quality"]["minimum_segment_count"])
                ],
                "node_colors": [None, None],
            }
        )
    )
    assert parsed_with_nulls["split"]["color"] == defaults["split_color"]
    assert parsed_with_nulls["node_colors"] == [
        defaults["node_color"],
        defaults["node_color"],
    ]

    for field in ("color", "bg_color"):
        with pytest.raises(RequestValidationError, match=field):
            parse_arguments(json.dumps({"simple_path": simple_path, field: None}))


@pytest.mark.parametrize("kind", ["simple", "split", "fallback"])
def test_quality_boundary_rejects_below_minimum_and_accepts_minimum(kind):
    minimum = CONTRACT["quality"]["minimum_segment_count"]
    assert MIN_SEGMENT_COUNT == minimum
    assert TOO_SIMPLE_MESSAGE == CONTRACT["quality"]["too_simple_message"]
    assert CONTRACT["quality"]["api_gate"]["measure"] == "rendered_path_segments"

    with pytest.raises(
        RequestValidationError,
        match=re.escape(CONTRACT["quality"]["too_simple_message"]),
    ):
        parse_arguments(json.dumps(payload_for(kind, minimum - 1)))

    assert parse_arguments(json.dumps(payload_for(kind, minimum)))


def test_api_fallback_parsing_matches_contract_examples():
    for example in CONTRACT["sentence_parsing"]["api_fallback_examples"]:
        assert split_into_sentences(example["input"]) == example["sentences"]
        assert split_into_sentence_lengths(example["input"]) == example["lengths"]


def test_simple_and_color_split_turtle_examples_match_contract():
    simple = CONTRACT["turtle_path"]["simple_example"]
    assert plot_simple_lengths(simple["lengths"]) == simple["path"]

    split = CONTRACT["turtle_path"]["split_example"]
    parsed = get_sentences(
        split["text"],
        {
            "words": split["highlight_words"],
            "color": split["highlight_color"],
        },
        split["primary_color"],
    )
    assert parsed == split["segments"]

    flattened = flattened_split_segments(plot_split_lengths(parsed))
    expected_vectors = CONTRACT["turtle_path"]["direction_vectors"]
    assert len(flattened) == len(parsed)
    for index, actual in enumerate(flattened):
        assert actual["color"] == parsed[index]["color"]
        assert actual["length"] == pytest.approx(parsed[index]["length"])
        assert actual["direction"] == expected_vectors[index % len(expected_vectors)]


def test_external_boundaries_are_documentation_only():
    png = CONTRACT["external_boundaries"]["png_conversion"]
    gallery = CONTRACT["external_boundaries"]["gallery"]

    assert png == {
        "ownership": "external_black_box",
        "request_fields": ["url", "bg_color"],
        "response_field": "svg_url",
        "executable_schema": False,
    }
    assert gallery["ownership_repository"] == "daviseford-landing-page"
    assert gallery["role"] == "external_consumer"
    assert gallery["executable_schema"] is False
