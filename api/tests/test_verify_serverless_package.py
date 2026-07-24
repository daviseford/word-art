import re
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from scripts.verify_serverless_package import (
    LAMBDA_MAX_UNPACKED_BYTES,
    PackageValidationError,
    inspect_package,
)


def write_package(path, files):
    with ZipFile(path, "w", compression=ZIP_DEFLATED) as archive:
        for name, body in files.items():
            archive.writestr(name, body)


def test_inspect_package_reports_compressed_and_unpacked_sizes(tmp_path):
    package = tmp_path / "word-art.zip"
    write_package(package, {"handler.py": b"print('ok')", "data.txt": b"12345"})

    result = inspect_package(tmp_path)

    assert result.path == package
    assert result.compressed_bytes == package.stat().st_size
    assert result.unpacked_bytes == len(b"print('ok')") + len(b"12345")
    assert result.max_unpacked_bytes == LAMBDA_MAX_UNPACKED_BYTES


@pytest.mark.parametrize("package_count", [0, 2])
def test_inspect_package_requires_exactly_one_zip(tmp_path, package_count):
    for index in range(package_count):
        write_package(tmp_path / f"package-{index}.zip", {"handler.py": b"ok"})

    with pytest.raises(
        PackageValidationError,
        match=f"expected exactly one ZIP package, found {package_count}",
    ):
        inspect_package(tmp_path)


def test_inspect_package_rejects_an_oversized_unpacked_artifact(tmp_path):
    write_package(tmp_path / "word-art.zip", {"large.bin": b"123456"})

    with pytest.raises(
        PackageValidationError,
        match="unpacked package is 6 bytes; limit is 5 bytes",
    ):
        inspect_package(tmp_path, max_unpacked_bytes=5)


def test_inspect_package_rejects_an_invalid_zip(tmp_path):
    package = tmp_path / "word-art.zip"
    package.write_bytes(b"not a zip")

    with pytest.raises(
        PackageValidationError,
        match=re.escape(f"invalid ZIP package: {package}"),
    ):
        inspect_package(tmp_path)
