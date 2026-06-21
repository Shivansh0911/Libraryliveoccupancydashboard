import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db, init_db, AsyncSessionLocal
from seed import seed_if_empty
from websocket_manager import manager
from dashboard import build_dashboard_state
from routes.regions import router as regions_router
from routes.counts import router as counts_router
from routes.admin import router as admin_router


async def offline_heartbeat():
    """Broadcast dashboard state every 10s so offline cameras show immediately."""
    while True:
        await asyncio.sleep(10)
        try:
            async with AsyncSessionLocal() as db:
                state = await build_dashboard_state(db)
                await manager.broadcast(state.model_dump_json())
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed_if_empty(session)
    task = asyncio.create_task(offline_heartbeat())
    yield
    task.cancel()


app = FastAPI(title="Campus Library Occupancy Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(regions_router, prefix="/regions", tags=["regions"])
app.include_router(counts_router, prefix="/count", tags=["counts"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])


@app.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    await manager.connect(websocket)
    try:
        # Send current state immediately on connect
        state = await build_dashboard_state(db)
        await websocket.send_text(state.model_dump_json())
        while True:
            await websocket.receive_text()  # keepalive — client pings to stay alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)
