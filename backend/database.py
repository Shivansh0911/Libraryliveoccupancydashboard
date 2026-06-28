from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

settings = get_settings()
engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    import models  # noqa: F401 — registers ORM models with Base.metadata
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Safe migration — adds reserved_count if table existed before this column was introduced
        await conn.execute(
            __import__("sqlalchemy").text(
                "ALTER TABLE count_logs ADD COLUMN IF NOT EXISTS reserved_count INTEGER DEFAULT 0"
            )
        )
