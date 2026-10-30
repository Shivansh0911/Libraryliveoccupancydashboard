import re

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

settings = get_settings()


def _normalize_db_url(url: str) -> str:
    """Accept the URL a host hands out and make it async-driver ready.

    - postgres:// or postgresql://  ->  postgresql+asyncpg://
    - translate libpq's ?sslmode=require (Neon/Supabase/Render external) into
      asyncpg's ?ssl=require, and drop params asyncpg doesn't understand.
    Render's internal database URL has no query string and is left as-is.
    """
    url = re.sub(r"^postgres(ql)?://", "postgresql+asyncpg://", url)
    if "?" not in url:
        return url
    base, query = url.split("?", 1)
    kept, want_ssl = [], False
    for part in filter(None, query.split("&")):
        key, _, val = part.partition("=")
        if key == "sslmode":
            want_ssl = val not in ("", "disable")
        elif key in ("channel_binding",):
            continue  # not understood by asyncpg
        else:
            kept.append(part)
    if want_ssl:
        kept.append("ssl=require")
    return base + ("?" + "&".join(kept) if kept else "")


engine = create_async_engine(_normalize_db_url(settings.DATABASE_URL), echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    import models  # noqa: F401 — registers ORM models with Base.metadata
    import sqlalchemy
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Safe migration — try/except handles both SQLite (no IF NOT EXISTS) and PostgreSQL
        for sql in [
            "ALTER TABLE count_logs ADD COLUMN reserved_count INTEGER DEFAULT 0",
            "ALTER TABLE regions ADD COLUMN section VARCHAR DEFAULT 'library'",
        ]:
            try:
                await conn.execute(sqlalchemy.text(sql))
            except Exception:
                pass  # column already exists
