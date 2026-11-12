"""Proof-of-registration uploads for doctor applications.

Files live in DOCTOR_DOCS_DIR (outside any static path) under random names, and are served
only to admins through an authenticated endpoint. On hosts with an ephemeral disk (e.g. Render
without a persistent disk) uploaded files are lost on redeploy.
"""

from __future__ import annotations

import re
import secrets
from pathlib import Path

from flask import current_app
from werkzeug.datastructures import FileStorage

MAX_BYTES = 5 * 1024 * 1024

# extension -> (accepted declared MIME types, magic-byte prefixes, MIME type to serve)
ALLOWED = {
    ".pdf": ({"application/pdf"}, (b"%PDF-",), "application/pdf"),
    ".png": ({"image/png"}, (b"\x89PNG\r\n\x1a\n",), "image/png"),
    ".jpg": ({"image/jpeg", "image/jpg", "image/pjpeg"}, (b"\xff\xd8\xff",), "image/jpeg"),
}
ALLOWED[".jpeg"] = ALLOWED[".jpg"]

_STORED_NAME = re.compile(r"^[0-9a-f]{32}\.(pdf|png|jpg)$")


class DocumentError(ValueError):
    pass


def docs_dir() -> Path:
    path = Path(current_app.config["DOCTOR_DOCS_DIR"])
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_document(upload: FileStorage) -> str:
    """Validate (extension, declared type, magic bytes, size) and store. Returns the file name."""
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise DocumentError("Upload a PDF, JPG or PNG file.")
    mimetypes, magics, _ = ALLOWED[ext]
    if (upload.mimetype or "").lower() not in mimetypes:
        raise DocumentError("The file type does not match its extension.")
    data = upload.stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise DocumentError("The file is larger than 5 MB.")
    if not data:
        raise DocumentError("The file is empty.")
    if not data.startswith(magics):
        raise DocumentError("The file content is not a valid PDF, JPG or PNG.")
    name = f"{secrets.token_hex(16)}{'.jpg' if ext == '.jpeg' else ext}"
    (docs_dir() / name).write_bytes(data)
    return name


def document_file(name: str | None) -> tuple[Path, str] | None:
    """(path, mimetype) of a stored document, or None if missing. Rejects anything odd."""
    if not name or not _STORED_NAME.match(name):
        return None
    path = docs_dir() / name
    if not path.is_file():
        return None
    return path, ALLOWED[path.suffix][2]


def delete_document(name: str | None) -> None:
    found = document_file(name)
    if found:
        found[0].unlink(missing_ok=True)
