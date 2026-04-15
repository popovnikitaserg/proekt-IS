from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import build_app
from app.settings import get_settings


@pytest.fixture
async def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    monkeypatch.setenv("DB_HOST", "localhost")
    monkeypatch.setenv("DB_PORT", "5432")
    monkeypatch.setenv("DB_NAME", "bigdata")
    monkeypatch.setenv("DB_USER", "bigdata")
    monkeypatch.setenv("DB_PASSWORD", "bigdata")
    monkeypatch.setenv("STORAGE_DIR", str(tmp_path / "uploads"))
    get_settings.cache_clear()

    app = build_app()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    get_settings.cache_clear()
