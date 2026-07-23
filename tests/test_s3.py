import hashlib

import s3
from conftest import FakeS3Client


def test_checksum_accepts_unicode_text():
    value = "word art \N{SPARKLES}"

    assert s3.get_checksum(value) == hashlib.sha1(value.encode("utf-8")).hexdigest()


def test_duplicate_lookup_requires_an_exact_object_key(use_fake_s3):
    fake = use_fake_s3(
        FakeS3Client(objects={"1234.svg": {"Body": b"existing"}})
    )

    assert s3.is_duplicate_checksum("123") is None
    assert s3.is_duplicate_checksum("1234").endswith("/1234.svg")
    assert fake.put_calls == []


def test_upload_sets_svg_metadata_and_utf8_body(use_fake_s3):
    fake = use_fake_s3()

    url = s3.upload_svg("abc.svg", "<svg>\N{SPARKLES}</svg>")

    assert url.endswith("/abc.svg")
    assert fake.put_calls == [
        {
            "ACL": "public-read",
            "Body": "<svg>\N{SPARKLES}</svg>".encode("utf-8"),
            "Bucket": s3.BUCKET,
            "ContentType": "image/svg+xml",
            "Key": "abc.svg",
        }
    ]
