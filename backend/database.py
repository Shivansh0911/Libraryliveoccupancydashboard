import re

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

settings = get_settings()


def _normalize_db_url(url: str) -> str:
    """Accept the URL Railway/Heroku hand out and make it async-driver ready.

    - postgres:// or postgresql://  ->  postgresql+asyncpg://
    - drop libpq's ?sslmode=... which asyncpg does not understand
    """
    url = re.sub(r"^postgres(ql)?://", "postgresql+asyncpg://", url)
    url = re.sub(r"[?&]sslmode=\w+", "", url)
    return url


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
