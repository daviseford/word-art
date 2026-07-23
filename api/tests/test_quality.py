import pytest

from quality import count_svg_segments


def test_count_svg_segments_sums_every_path_element():
    svg = b'''<svg xmlns="http://www.w3.org/2000/svg">
      <path d="M 0 0 L 1 1 L 2 2" />
      <path d="M 3 3 H 4 V 5" />
    </svg>'''

    assert count_svg_segments(svg) == 4


def test_count_svg_segments_rejects_malformed_svg():
    with pytest.raises(ValueError, match="valid SVG"):
        count_svg_segments(b"not svg")
