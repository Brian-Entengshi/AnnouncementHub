"""File-backed SQLite tests exercise the same locking mode as development."""

import os
import tempfile
from pathlib import Path
from .settings import *  # noqa: F403

DATABASES["default"]["TEST"] = {
    "NAME": str(Path(tempfile.gettempdir()) / f"elite-tests-{os.getpid()}.sqlite3")
}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
