import io
import json

import pytest

from scripts.cleanup_low_quality import apply_cleanup, build_cleanup_plan


def svg_with_segments(count):
    commands = " ".join(f"L {index} {index}" for index in range(1, count + 1))
    return f'<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 {commands}" /></svg>'.encode()


class FakePaginator:
    def __init__(self, client):
        self.client = client

    def paginate(self, Bucket):
        yield {
            "Contents": [
                {
                    "Key": key,
                    "Size": len(body),
                    "ETag": f'"etag-{key}"',
                    "LastModified": "2026-07-22T00:00:00Z",
                }
                for key, body in self.client.objects.get(Bucket, {}).items()
            ]
        }


class FakeCleanupS3:
    def __init__(self, objects):
        self.objects = {bucket: dict(values) for bucket, values in objects.items()}
        self.delete_calls = []

    def get_paginator(self, operation):
        assert operation == "list_objects_v2"
        return FakePaginator(self)

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[Bucket][Key])}

    def delete_objects(self, Bucket, Delete):
        keys = [entry["Key"] for entry in Delete["Objects"]]
        self.delete_calls.append((Bucket, keys))
        for key in keys:
            self.objects[Bucket].pop(key)
        return {"Deleted": [{"Key": key} for key in keys], "Errors": []}


def test_plan_uses_twenty_segment_boundary_and_pairs_pngs():
    fake = FakeCleanupS3(
        {
            "word-art-svgs": {
                "19.svg": svg_with_segments(19),
                "20.svg": svg_with_segments(20),
                "abc.svg": svg_with_segments(1),
                "notes.txt": b"ignored",
            },
            "word-art-pngs": {"19.png": b"png", "20.png": b"png"},
        }
    )

    plan = build_cleanup_plan(fake, threshold=20, workers=1)

    assert [(entry["stem"], entry["segments"]) for entry in plan] == [
        ("19", 19),
        ("abc", 1),
    ]
    assert [obj["key"] for obj in plan[0]["objects"]] == ["19.svg", "19.png"]
    assert [obj["key"] for obj in plan[1]["objects"]] == ["abc.svg"]


def test_apply_backs_up_every_object_before_deleting(tmp_path):
    fake = FakeCleanupS3(
        {
            "word-art-svgs": {"bad.svg": svg_with_segments(2)},
            "word-art-pngs": {"bad.png": b"png bytes"},
        }
    )
    plan = build_cleanup_plan(fake, threshold=20, workers=1)
    backup_dir = tmp_path / "backup"

    result = apply_cleanup(fake, plan, backup_dir, threshold=20)

    assert fake.objects == {"word-art-svgs": {}, "word-art-pngs": {}}
    assert (backup_dir / "word-art-svgs" / "bad.svg").read_bytes() == svg_with_segments(2)
    assert (backup_dir / "word-art-pngs" / "bad.png").read_bytes() == b"png bytes"
    manifest = json.loads((backup_dir / "manifest.json").read_text())
    assert manifest["threshold"] == 20
    assert manifest["candidate_count"] == 1
    assert result["deleted_object_count"] == 2


def test_apply_aborts_before_deletion_when_backup_directory_exists(tmp_path):
    fake = FakeCleanupS3(
        {"word-art-svgs": {"bad.svg": svg_with_segments(1)}, "word-art-pngs": {}}
    )
    plan = build_cleanup_plan(fake, threshold=20, workers=1)
    backup_dir = tmp_path / "backup"
    backup_dir.mkdir()

    with pytest.raises(FileExistsError):
        apply_cleanup(fake, plan, backup_dir, threshold=20)

    assert fake.delete_calls == []
