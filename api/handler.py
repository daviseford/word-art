import json
import logging
import re

from colors import DEFAULT_COLORS
from parse_sentences import split_into_sentence_lengths
from quality import MIN_SEGMENT_COUNT, TOO_SIMPLE_MESSAGE
from s3 import is_duplicate_checksum
from svg_simple import get_simple_preparsed_paths, save_simple_xml_to_s3
from svg_split import save_split_xml_to_s3, satisfies_split_conditions

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MAX_BODY_BYTES = 1_000_000
CHECKSUM_PATTERN = re.compile(r"^[0-9]{1,32}$")
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$")
CORS_HEADERS = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
}


class RequestValidationError(ValueError):
    pass


def _validate_color(value, field_name):
    if not isinstance(value, str) or not HEX_COLOR_PATTERN.fullmatch(value):
        raise RequestValidationError(f"{field_name} must be a 3- or 6-digit hex color")
    return value


def _validate_split(split):
    if split is None:
        return None
    if not isinstance(split, dict):
        raise RequestValidationError("split must be an object")

    words = split.get("words")
    if not isinstance(words, list) or not words or not all(isinstance(word, str) and word for word in words):
        raise RequestValidationError("split.words must be a non-empty list of strings")

    return {
        "words": words,
        "color": _validate_color(split.get("color") or DEFAULT_COLORS["split_color"], "split.color"),
    }


def _validate_split_preparsed(value):
    if value is None:
        return None
    if not isinstance(value, list) or not value:
        raise RequestValidationError("split_pre_parsed must be a non-empty list")

    parsed = []
    for segment in value:
        if not isinstance(segment, dict):
            raise RequestValidationError("split_pre_parsed entries must be objects")
        length = segment.get("length")
        if not isinstance(length, int) or isinstance(length, bool) or length <= 0:
            raise RequestValidationError("split_pre_parsed lengths must be positive integers")
        parsed.append({
            "color": _validate_color(segment.get("color"), "split_pre_parsed color"),
            "length": length,
        })
    return parsed


def parse_arguments(event_body):
    if not isinstance(event_body, str) or not event_body:
        raise RequestValidationError("Request body must be JSON")
    if len(event_body.encode("utf-8")) > MAX_BODY_BYTES:
        raise RequestValidationError("Request body is too large")

    try:
        json_obj = json.loads(event_body)
    except json.JSONDecodeError as exc:
        raise RequestValidationError("Request body must be valid JSON") from exc
    if not isinstance(json_obj, dict):
        raise RequestValidationError("Request body must be a JSON object")

    split = _validate_split(json_obj.get("split"))
    split_pre_parsed = _validate_split_preparsed(json_obj.get("split_pre_parsed"))

    node_colors = json_obj.get("node_colors")
    if node_colors is not None:
        if not isinstance(node_colors, list) or len(node_colors) != 2:
            raise RequestValidationError("node_colors must contain exactly two colors")
        node_colors = [
            DEFAULT_COLORS["node_colors"] if color is None else _validate_color(color, "node_colors")
            for color in node_colors
        ]

    checksum = json_obj.get("checksum")
    if checksum is not None and (
        not isinstance(checksum, str) or not CHECKSUM_PATTERN.fullmatch(checksum)
    ):
        raise RequestValidationError("checksum must contain only decimal digits")

    text = json_obj.get("text")
    simple_path = json_obj.get("simple_path")
    if text is not None and not isinstance(text, str):
        raise RequestValidationError("text must be a string")
    text_sentence_lengths = split_into_sentence_lengths(text) if text is not None else None
    if text is not None and not text_sentence_lengths:
        raise RequestValidationError("text must contain at least one sentence")
    if simple_path is not None and not isinstance(simple_path, str):
        raise RequestValidationError("simple_path must be a string")
    simple_pre_parsed = None
    if simple_path is not None:
        try:
            simple_pre_parsed = get_simple_preparsed_paths(simple_path)
        except (IndexError, KeyError, TypeError, ValueError) as exc:
            raise RequestValidationError("simple_path must be a valid SVG path") from exc
        if not simple_pre_parsed:
            raise RequestValidationError("simple_path must contain at least one segment")

    if split is not None:
        if not split_pre_parsed and not text:
            raise RequestValidationError("split requests require split_pre_parsed or text")
    elif not simple_path and not text:
        raise RequestValidationError("simple requests require simple_path or text")

    if split is not None:
        segment_count = len(split_pre_parsed) if split_pre_parsed else len(text_sentence_lengths)
    else:
        segment_count = len(simple_pre_parsed) if simple_pre_parsed else len(text_sentence_lengths)
    if segment_count < MIN_SEGMENT_COUNT:
        raise RequestValidationError(TOO_SIMPLE_MESSAGE)

    return {
        "text": text,
        "node_colors": node_colors,
        "color": _validate_color(json_obj.get("color", DEFAULT_COLORS["color"]), "color"),
        "split": split,
        "simple_pre_parsed": json_obj.get("simple_pre_parsed"),
        "split_pre_parsed": split_pre_parsed,
        "simple_path": simple_path,
        "split_path": json_obj.get("split_path"),
        "checksum": checksum,
        "bg_color": _validate_color(json_obj.get("bg_color", DEFAULT_COLORS["bg_color"]), "bg_color"),
    }


def _response(status_code, body=None):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": "" if body is None else json.dumps(body),
    }


def _request_method(event):
    method = event.get("httpMethod")
    if method is None:
        method = event.get("requestContext", {}).get("http", {}).get("method")
    return method.upper() if isinstance(method, str) else None


def endpoint(event, context):
    if _request_method(event) == "OPTIONS":
        return _response(204)

    try:
        arguments = parse_arguments(event.get("body"))
        existing_url = is_duplicate_checksum(arguments["checksum"])
        body = {"arguments": arguments, "duplicate": False}

        if existing_url is not None:
            logger.info("Duplicate detected for %s", arguments["checksum"])
            body["s3_url"] = existing_url
            body["duplicate"] = True
        elif satisfies_split_conditions(arguments):
            logger.info("Creating split SVG")
            body["s3_url"] = save_split_xml_to_s3(arguments)
        else:
            body["s3_url"] = save_simple_xml_to_s3(arguments)

        return _response(200, body)
    except RequestValidationError as exc:
        return _response(400, {"err": str(exc)})
    except Exception:
        logger.exception("Unable to generate SVG")
        return _response(500, {"err": "Unable to generate SVG"})
