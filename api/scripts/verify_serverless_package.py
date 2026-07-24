from dataclasses import dataclass
from pathlib import Path
from zipfile import BadZipFile, ZipFile


LAMBDA_MAX_UNPACKED_BYTES = 250 * 1024 * 1024


class PackageValidationError(ValueError):
    pass


@dataclass(frozen=True)
class PackageReport:
    path: Path
    compressed_bytes: int
    unpacked_bytes: int
    max_unpacked_bytes: int


def inspect_package(
    package_directory,
    *,
    max_unpacked_bytes=LAMBDA_MAX_UNPACKED_BYTES,
):
    package_directory = Path(package_directory)
    packages = sorted(package_directory.glob("*.zip"))
    if len(packages) != 1:
        raise PackageValidationError(
            f"expected exactly one ZIP package, found {len(packages)}"
        )

    package = packages[0]
    try:
        with ZipFile(package) as archive:
            unpacked_bytes = sum(entry.file_size for entry in archive.infolist())
    except BadZipFile as error:
        raise PackageValidationError(f"invalid ZIP package: {package}") from error

    if unpacked_bytes > max_unpacked_bytes:
        raise PackageValidationError(
            f"unpacked package is {unpacked_bytes} bytes; "
            f"limit is {max_unpacked_bytes} bytes"
        )

    return PackageReport(
        path=package,
        compressed_bytes=package.stat().st_size,
        unpacked_bytes=unpacked_bytes,
        max_unpacked_bytes=max_unpacked_bytes,
    )


def main():
    report = inspect_package(Path(".serverless"))
    compressed_mib = report.compressed_bytes / (1024 * 1024)
    unpacked_mib = report.unpacked_bytes / (1024 * 1024)
    limit_mib = report.max_unpacked_bytes / (1024 * 1024)
    print(
        f"Package {report.path.name}: {compressed_mib:.1f} MiB compressed, "
        f"{unpacked_mib:.1f} MiB unpacked (limit {limit_mib:.0f} MiB)."
    )


if __name__ == "__main__":
    main()
