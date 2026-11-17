import asyncio
import gzip
import json
import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from volunteers.services.mailing_template import TemplateContext

_ASSETS = Path(__file__).with_name("print_assets")


def starter_source() -> str:
    return (_ASSETS / "badge.typ").read_text(encoding="utf-8")


def default_assets() -> list[tuple[str, str, bytes]]:
    return [
        ("std.typ", "text/plain", (_ASSETS / "std.typ").read_bytes()),
        (
            "NotoSans-Regular.ttf",
            "font/ttf",
            gzip.decompress((_ASSETS / "NotoSans-Regular.ttf.gz").read_bytes()),
        ),
    ]


class PrintCompilationError(Exception):
    pass


class PrintCompilationTimeout(PrintCompilationError):
    def __init__(self) -> None:
        super().__init__("Print template compilation timed out")


_RENDER_SLOTS = asyncio.Semaphore(2)
_RENDER_TIMEOUT = 15


async def compile_pdf(
    source: str,
    contexts: list[TemplateContext],
    assets: dict[str, bytes],
) -> bytes:
    async with _RENDER_SLOTS:
        with TemporaryDirectory(prefix="print-template-") as directory:
            root = Path(directory)
            for name, data in assets.items():
                (root / name).write_bytes(data)
            (root / "main.typ").write_text(
                '#import "std.typ": *\n#let data = json("data.json")\n' + source,
                encoding="utf-8",
            )
            (root / "data.json").write_text(
                json.dumps(
                    [context.model_dump(mode="json") for context in contexts], ensure_ascii=False
                ),
                encoding="utf-8",
            )
            # Typst's registry downloader honors the proxy settings. A private
            # home and explicit package roots exclude any installed packages.
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                str(Path(__file__).with_name("print_pdf_worker.py")),
                cwd=root,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
                env={
                    "HOME": directory,
                    "XDG_CACHE_HOME": directory,
                    "XDG_DATA_HOME": directory,
                    "PYTHONPATH": os.environ.get("PYTHONPATH", ""),
                    "HTTPS_PROXY": "http://127.0.0.1:0",
                    "HTTP_PROXY": "http://127.0.0.1:0",
                    "RAYON_NUM_THREADS": "2",
                },
            )
            try:
                async with asyncio.timeout(_RENDER_TIMEOUT):
                    _, errors = await process.communicate()
            except TimeoutError as e:
                raise PrintCompilationTimeout from e
            finally:
                if process.returncode is None:
                    process.kill()
                    await process.wait()
            if process.returncode:
                # Replace the private absolute path with the template-relative filename.
                diagnostic = errors.decode(errors="replace").replace(f"{root}/", "")
                raise PrintCompilationError(
                    diagnostic.strip() or "Print template compilation failed"
                )
            return (root / "output.pdf").read_bytes()
