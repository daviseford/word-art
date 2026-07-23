from xml.etree import ElementTree

from svgpathtools import parse_path


MIN_SEGMENT_COUNT = 20
TOO_SIMPLE_MESSAGE = (
    f"Your prompt is too simple. Try at least {MIN_SEGMENT_COUNT} distinct sentences"
)


def count_svg_segments(svg_document):
    try:
        root = ElementTree.fromstring(svg_document)
        if root.tag.rsplit("}", 1)[-1] != "svg":
            raise ValueError

        return sum(
            len(parse_path(element.attrib["d"]))
            for element in root.iter()
            if element.tag.rsplit("}", 1)[-1] == "path" and element.attrib.get("d")
        )
    except (ElementTree.ParseError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("Object must contain valid SVG paths") from exc
