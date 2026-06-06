from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from auth import get_current_admin, create_access_token
from schemas import TokenResponse
from config import get_settings

router = APIRouter()
settings = get_settings()


class LoginPayload(BaseModel):
    username: str
    password: str


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginPayload):
    if (
        payload.username != settings.ADMIN_USERNAME
        or payload.password != settings.ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_access_token({"sub": payload.username})
    return TokenResponse(access_token=token)


@router.get("/me")
async def get_me(username: str = Depends(get_current_admin)):
    return {"username": username}
