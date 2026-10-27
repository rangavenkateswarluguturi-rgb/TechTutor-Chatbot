import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "local-development-only-change-me")
    DATABASE_PATH = os.environ.get(
        "DATABASE_PATH", str(PROJECT_ROOT / "instance" / "techtutor.db")
    )
    OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
    DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:latest")
    MAX_CONTENT_LENGTH = 2 * 1024 * 1024
    MAX_MESSAGE_LENGTH = 8_000
    MAX_ATTACHMENT_BYTES = 256 * 1024
    MAX_ATTACHMENTS = 5
    MAX_HISTORY_MESSAGES = 20
