from functools import cache
from pathlib import Path

from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.enums import Env, LogMode

__version__ = "0.1.0"


class Settings(BaseSettings):
    environment: Env = Env.LOCAL
    log_level: str = "INFO"
    log_mode: LogMode = LogMode.PRETTY
    sentry_dsn: str | None = None

    db_host: str = "postgres"
    db_port: int = 5432
    db_name: str = "bigdata"
    db_user: str = "bigdata"
    db_password: str = "bigdata"

    storage_dir: Path = Field(default_factory=lambda: Path(".data/uploads"))
    max_upload_size_mb: int = 512

    model_config = SettingsConfigDict(env_file=".env")

    @property
    def db_dsn(self) -> str:
        dsn = PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            path=self.db_name,
        )

        return dsn.encoded_string()


@cache
def get_settings() -> Settings:
    return Settings()
