from pathlib import Path

import yaml


def test_s3_permissions_cover_exact_lookup_and_upload_without_bucket_listing():
    config = yaml.safe_load(Path("serverless.yml").read_text(encoding="utf-8"))
    statements = config["provider"]["iam"]["role"]["statements"]

    assert {
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject", "s3:PutObjectAcl"],
        "Resource": "arn:aws:s3:::word-art-svgs/*",
    } in statements
    assert all("s3:ListBucket" not in statement["Action"] for statement in statements)
