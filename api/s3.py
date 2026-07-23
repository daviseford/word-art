import hashlib
import logging

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

BUCKET = "word-art-svgs"
_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3")
    return _s3_client


def get_checksum(value):
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def get_filename(checksum):
    return f"{checksum}.svg"


def get_public_url(filename):
    return f"https://s3.amazonaws.com/{BUCKET}/{filename}"


def is_duplicate_checksum(checksum):
    if checksum is None:
        return None

    filename = get_filename(checksum)
    try:
        get_s3_client().head_object(Bucket=BUCKET, Key=filename)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code in {"404", "NoSuchKey", "NotFound"}:
            return None
        raise
    return get_public_url(filename)


def upload_svg(filename, xml_string):
    get_s3_client().put_object(
        ACL="public-read",
        Body=xml_string.encode("utf-8"),
        Bucket=BUCKET,
        ContentType="image/svg+xml",
        Key=filename,
    )
    return get_public_url(filename)


def save_svg(xml_string, checksum=None):
    if checksum is None:
        checksum = get_checksum(xml_string)
        existing_url = is_duplicate_checksum(checksum)
        if existing_url is not None:
            logger.info("Duplicate detected for %s", checksum)
            return existing_url

    return upload_svg(get_filename(checksum), xml_string)
