"""Compile the files prepared in the worker's private current directory."""

import resource
import sys
from pathlib import Path

import typst
from fontTools.ttLib import TTLibError
from fontTools.ttLib.woff2 import decompress


def main() -> int:
    resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024**2, 32 * 1024**2))
    if sys.platform == "linux":
        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024**2, 768 * 1024**2))
    root = Path.cwd()
    # Typst discovers SFNT fonts. Keep original assets at their declared paths
    # and prepare separate compiler inputs for the compressed WOFF2 variants.
    fonts = root / ".fonts"
    fonts.mkdir()
    for index, file in enumerate(root.iterdir()):
        if file.suffix.lower() != ".woff2":
            continue
        try:
            with file.open("rb") as source, (fonts / f"{index}.ttf").open("wb") as output:
                decompress(source, output)
        except (TTLibError, OSError):
            sys.stderr.write(f"Cannot read WOFF2 font: {file.name}")
            return 1
    compiler = typst.Compiler(
        root / "main.typ",
        root=root,
        font_paths=[root],
        ignore_system_fonts=True,
        package_path=root / "packages",
        package_cache_path=root / "package-cache",
    )
    try:
        compiler.compile(output=root / "output.pdf", format="pdf")
    except typst.TypstError as error:
        sys.stderr.write((error.diagnostic or str(error))[:8000])
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
