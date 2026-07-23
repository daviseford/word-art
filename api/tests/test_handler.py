import json

import pytest

import handler
from conftest import FakeS3Client
from quality import count_svg_segments


def invoke(payload=None, method="POST", raw_body=None):
    body = raw_body if raw_body is not None else json.dumps(payload)
    return handler.endpoint({"httpMethod": method, "body": body}, None)


def response_body(response):
    return json.loads(response["body"]) if response.get("body") else None


def simple_path_with_segments(count):
    commands = " ".join(f"L {index} {index}" for index in range(1, count + 1))
    return f"M 0 0 {commands}"


def simple_payload(checksum="123456"):
    return {
        "simple_path": simple_path_with_segments(20),
        "color": "#14B6D4",
        "bg_color": "#052D3E",
        "node_colors": ["#D87D0F", "#A63305"],
        "checksum": checksum,
        "version": 1,
    }


def test_options_returns_without_touching_storage(use_fake_s3):
    fake = use_fake_s3()

    response = invoke(method="OPTIONS", raw_body=None)

    assert response["statusCode"] == 204
    assert fake.put_calls == []


def test_simple_request_renders_svg_and_preserves_response_contract(use_fake_s3):
    fake = use_fake_s3()
    payload = simple_payload()

    response = invoke(payload)
    body = response_body(response)

    assert response["statusCode"] == 200
    assert body["duplicate"] is False
    assert body["arguments"]["checksum"] == payload["checksum"]
    assert body["s3_url"].endswith("/123456.svg")
    assert fake.put_calls[0]["ContentType"] == "image/svg+xml"
    assert b"<svg" in fake.put_calls[0]["Body"]


def test_second_request_returns_exact_duplicate_without_uploading(use_fake_s3):
    fake = use_fake_s3()
    payload = simple_payload()
    invoke(payload)

    response = invoke(payload)
    body = response_body(response)

    assert response["statusCode"] == 200
    assert body["duplicate"] is True
    assert body["s3_url"].endswith("/123456.svg")
    assert len(fake.put_calls) == 1


def test_split_preparsed_request_renders_all_segments(use_fake_s3):
    fake = use_fake_s3()
    payload = simple_payload("789")
    payload.pop("simple_path")
    payload["split"] = {"words": ["love"], "color": "#F22F00"}
    payload["split_pre_parsed"] = [
        {"color": "#14B6D4" if index % 2 == 0 else "#F22F00", "length": index + 1}
        for index in range(20)
    ]

    response = invoke(payload)

    assert response["statusCode"] == 200
    assert len(fake.put_calls) == 1
    assert count_svg_segments(fake.put_calls[0]["Body"]) == 20


def test_split_request_uses_default_when_optional_color_is_null(use_fake_s3):
    fake = use_fake_s3()
    payload = simple_payload("790")
    payload.pop("simple_path")
    payload["split"] = {"words": ["love"], "color": None}
    payload["split_pre_parsed"] = [
        {"color": "#14B6D4" if index % 2 == 0 else "#F22F00", "length": index + 1}
        for index in range(20)
    ]

    response = invoke(payload)

    assert response["statusCode"] == 200
    assert count_svg_segments(fake.put_calls[0]["Body"]) == 20


def test_text_fallback_renders_word_counts(use_fake_s3):
    fake = use_fake_s3()

    response = invoke({"text": ".".join(["one two", *(["three"] * 19)]), "checksum": "234"})

    assert response["statusCode"] == 200
    assert count_svg_segments(fake.put_calls[0]["Body"]) == 20


def test_split_text_fallback_renders_each_color_segment(use_fake_s3):
    fake = use_fake_s3()
    payload = {
        "text": ".".join(["one two", *(["three"] * 19)]),
        "split": {"words": ["three"], "color": "#ff0000"},
        "checksum": "345",
    }

    response = invoke(payload)
    svg = fake.put_calls[0]["Body"]

    assert response["statusCode"] == 200
    assert svg.count(b"<path") == 2
    assert b'stroke="#14B6D4"' in svg
    assert b'stroke="#ff0000"' in svg


@pytest.mark.parametrize(
    "payload",
    [
        {
            "simple_path": simple_path_with_segments(19),
            "checksum": "901",
        },
        {
            "split": {"words": ["highlight"], "color": "#ff0000"},
            "split_pre_parsed": [
                {"color": "#14B6D4", "length": index + 1}
                for index in range(19)
            ],
            "checksum": "902",
        },
        {
            "text": ".".join([f"sentence {index}" for index in range(19)]),
            "checksum": "903",
        },
    ],
)
def test_requests_below_twenty_segments_are_rejected(payload, use_fake_s3):
    fake = use_fake_s3()

    response = invoke(payload)

    assert response["statusCode"] == 400
    assert response_body(response) == {
        "err": "Your prompt is too simple. Try at least 20 distinct sentences"
    }
    assert fake.put_calls == []


def test_missing_checksum_uses_rendered_svg_hash(use_fake_s3):
    fake = use_fake_s3()
    payload = simple_payload()
    payload.pop("checksum")

    response = invoke(payload)
    body = response_body(response)

    assert response["statusCode"] == 200
    filename = body["s3_url"].rsplit("/", 1)[-1]
    assert filename.endswith(".svg")
    assert len(filename.removesuffix(".svg")) == 40
    assert list(fake.objects) == [filename]


@pytest.mark.parametrize(
    "raw_body,payload",
    [
        ("{", None),
        (None, {}),
        (None, {"checksum": "../../unsafe", "simple_path": "M 0 0 H 1"}),
        (None, {"color": "red", "simple_path": "M 0 0 H 1"}),
        (None, {"node_colors": ["#fff"], "simple_path": "M 0 0 H 1"}),
        (None, {"text": "   "}),
        (None, {"text": "..."}),
        (None, {"simple_path": "   "}),
        (None, {"simple_path": "not a path"}),
        (None, {"split": {"words": []}, "text": "one.two."}),
        (None, {"split": {"words": ["one"]}, "split_pre_parsed": [{"color": "#fff", "length": 0}]}),
    ],
)
def test_invalid_requests_return_400_without_uploading(raw_body, payload, use_fake_s3):
    fake = use_fake_s3()

    response = invoke(payload, raw_body=raw_body)

    assert response["statusCode"] == 400
    assert "err" in response_body(response)
    assert fake.put_calls == []


def test_storage_failure_returns_500_instead_of_an_error_url(use_fake_s3):
    fake = use_fake_s3(FakeS3Client(fail_put=True))

    response = invoke(simple_payload())

    assert response["statusCode"] == 500
    assert response_body(response) == {"err": "Unable to generate SVG"}
    assert fake.put_calls == []
