from datetime import UTC, datetime

UPLOAD_CHUNK_BYTES: int = 1024 * 1024


def utc_now_naive() -> datetime:

    return datetime.now(tz=UTC).replace(tzinfo=None)
