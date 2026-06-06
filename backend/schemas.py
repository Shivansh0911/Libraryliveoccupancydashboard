from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict


class RegionCreate(BaseModel):
    name: str
    camera_id: str
    capacity: int
    description: Optional[str] = None


class RegionUpdate(BaseModel):
    name: Optional[str] = None
    camera_id: Optional[str] = None
    capacity: Optional[int] = None
    description: Optional[str] = None


class CountUpdatePayload(BaseModel):
    camera_id: str
    count: int
    timestamp: Optional[datetime] = None


class RegionOut(BaseModel):
    id: int
    name: str
    camera_id: str
    capacity: int
    current_count: int
    occupancy_pct: float
    status: Literal["free", "moderate", "full", "offline"]
    camera_online: bool
    last_updated: Optional[datetime]
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DashboardBroadcast(BaseModel):
    regions: list[RegionOut]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
