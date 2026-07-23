import copy

import pytest
from botocore.exceptions import ClientError

import s3


class FakeS3Client:
    def __init__(self, objects=None, fail_put=False):
        self.objects = copy.deepcopy(objects or {})
        self.fail_put = fail_put
        self.put_calls = []

    def head_object(self, Bucket, Key):
        if Key not in self.objects:
            raise ClientError(
                {"Error": {"Code": "404", "Message": "Not Found"}},
                "HeadObject",
            )
        return {"ContentLength": len(self.objects[Key]["Body"])}

    def list_objects_v2(self, Bucket, EncodingType, Prefix):
        matches = [key for key in self.objects if key.startswith(Prefix)]
        return {
            "KeyCount": len(matches),
            "Contents": [{"Key": key} for key in matches],
        }

    def put_object(self, **kwargs):
        if self.fail_put:
            raise ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "Denied"}},
                "PutObject",
            )
        self.put_calls.append(kwargs)
        self.objects[kwargs["Key"]] = kwargs
        return {"ETag": '"fake"'}


@pytest.fixture
def use_fake_s3(monkeypatch):
    def install(client=None):
        fake = client or FakeS3Client()
        monkeypatch.setattr(s3.boto3, "client", lambda service: fake)
        monkeypatch.setattr(s3, "get_s3_client", lambda: fake, raising=False)
        return fake

    return install
