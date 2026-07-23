import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath

import boto3
from botocore.config import Config

from quality import MIN_SEGMENT_COUNT, count_svg_segments


SVG_BUCKET = "word-art-svgs"
PNG_BUCKET = "word-art-pngs"


def _list_objects(s3_client, bucket):
    objects = {}
    for page in s3_client.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        for item in page.get("Contents", []):
            objects[item["Key"]] = {
                "bucket": bucket,
                "key": item["Key"],
                "size": item["Size"],
                "etag": item.get("ETag"),
                "last_modified": _json_value(item.get("LastModified")),
            }
    return objects


def _json_value(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def build_cleanup_plan(s3_client, threshold=MIN_SEGMENT_COUNT, workers=16):
    svg_objects = _list_objects(s3_client, SVG_BUCKET)
    png_objects = _list_objects(s3_client, PNG_BUCKET)
    svg_items = [item for key, item in svg_objects.items() if key.endswith(".svg")]

    def inspect(item):
        body = s3_client.get_object(Bucket=SVG_BUCKET, Key=item["key"])["Body"].read()
        return item, count_svg_segments(body)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        inspected = list(pool.map(inspect, svg_items))

    plan = []
    for svg_object, segment_count in inspected:
        if segment_count >= threshold:
            continue
        stem = svg_object["key"][:-4]
        objects = [svg_object]
        png_object = png_objects.get(f"{stem}.png")
        if png_object:
            objects.append(png_object)
        plan.append({"stem": stem, "segments": segment_count, "objects": objects})
    return sorted(plan, key=lambda entry: entry["stem"])


def _backup_path(backup_dir, bucket, key):
    key_path = PurePosixPath(key)
    if key_path.is_absolute() or ".." in key_path.parts:
        raise ValueError(f"Unsafe S3 key cannot be backed up: {key}")
    destination = backup_dir / bucket / Path(*key_path.parts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    return destination


def apply_cleanup(s3_client, plan, backup_dir, threshold=MIN_SEGMENT_COUNT):
    backup_dir = Path(backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=False)
    backed_up_plan = []

    for entry in plan:
        backed_up_objects = []
        for obj in entry["objects"]:
            body = s3_client.get_object(Bucket=obj["bucket"], Key=obj["key"])["Body"].read()
            if len(body) != obj["size"]:
                raise IOError(f"Backup size mismatch for s3://{obj['bucket']}/{obj['key']}")
            destination = _backup_path(backup_dir, obj["bucket"], obj["key"])
            destination.write_bytes(body)
            backed_up_objects.append(
                {
                    **obj,
                    "backup_path": str(destination.relative_to(backup_dir)),
                    "sha256": hashlib.sha256(body).hexdigest(),
                }
            )
        backed_up_plan.append({**entry, "objects": backed_up_objects})

    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "threshold": threshold,
        "candidate_count": len(backed_up_plan),
        "object_count": sum(len(entry["objects"]) for entry in backed_up_plan),
        "entries": backed_up_plan,
    }
    (backup_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8"
    )

    keys_by_bucket = defaultdict(list)
    for entry in backed_up_plan:
        for obj in entry["objects"]:
            keys_by_bucket[obj["bucket"]].append(obj["key"])

    deleted = []
    errors = []
    for bucket, keys in keys_by_bucket.items():
        for offset in range(0, len(keys), 1000):
            response = s3_client.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": key} for key in keys[offset : offset + 1000]]},
            )
            deleted.extend({"bucket": bucket, "key": item["Key"]} for item in response.get("Deleted", []))
            errors.extend({"bucket": bucket, **item} for item in response.get("Errors", []))

    result = {
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "deleted_object_count": len(deleted),
        "deleted": deleted,
        "errors": errors,
    }
    (backup_dir / "result.json").write_text(
        json.dumps(result, indent=2, sort_keys=True), encoding="utf-8"
    )
    if errors:
        raise RuntimeError(f"S3 reported {len(errors)} deletion errors; see result.json")
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Find low-quality Word Art SVGs and optionally back up and delete their SVG/PNG pairs."
    )
    parser.add_argument("--threshold", type=int, default=MIN_SEGMENT_COUNT)
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--show-candidates", action="store_true")
    args = parser.parse_args()
    if args.apply and args.backup_dir is None:
        parser.error("--backup-dir is required with --apply")

    s3_client = boto3.Session(region_name="us-east-1").client(
        "s3", config=Config(max_pool_connections=max(args.workers, 10))
    )
    plan = build_cleanup_plan(s3_client, threshold=args.threshold, workers=args.workers)
    summary = {
        "threshold": args.threshold,
        "candidate_count": len(plan),
        "svg_object_count": len(plan),
        "png_object_count": sum(len(entry["objects"]) == 2 for entry in plan),
    }
    if args.show_candidates:
        summary["candidates"] = [
            {"stem": entry["stem"], "segments": entry["segments"]} for entry in plan
        ]
    print(json.dumps(summary, indent=2))
    if args.apply:
        result = apply_cleanup(s3_client, plan, args.backup_dir, threshold=args.threshold)
        print(json.dumps({
            "backup_dir": str(args.backup_dir),
            "deleted_object_count": result["deleted_object_count"],
            "error_count": len(result["errors"]),
        }, indent=2))


if __name__ == "__main__":
    main()
