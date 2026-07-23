from parse_sentences import split_into_sentence_lengths
from svg_split import get_sentences


def test_sentence_lengths_ignore_empty_trailing_segment():
    assert split_into_sentence_lengths("one two.three.") == [2, 1]


def test_split_fallback_measures_words_not_characters():
    split = {"words": ["three"], "color": "#ff0000"}

    assert get_sentences("one two.three.", split, "#000000") == [
        {"color": "#000000", "length": 2},
        {"color": "#ff0000", "length": 1},
    ]
