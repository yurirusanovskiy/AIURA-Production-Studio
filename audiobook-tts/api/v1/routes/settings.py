from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from pydantic import BaseModel
import logging
from db.database import get_session
from db.models import APIKey, Settings
from core.crypto import encrypt as _encrypt_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

class APIKeyCreate(BaseModel):
    name: str
    key_value: str

class APIKeyResponse(BaseModel):
    id: int
    name: str
    is_exhausted: bool
    is_active: bool

class SettingsResponse(BaseModel):
    id: int
    active_api_key_id: int | None

@router.get("/api-keys", response_model=List[APIKeyResponse])
def get_api_keys(session: Session = Depends(get_session)):
    keys = session.exec(select(APIKey)).all()
    settings = session.exec(select(Settings)).first()
    active_id = settings.active_api_key_id if settings else None
    
    return [
        APIKeyResponse(
            id=k.id,
            name=k.name,
            is_exhausted=k.is_exhausted,
            is_active=(k.id == active_id)
        )
        for k in keys
    ]

@router.post("/api-keys")
def add_api_key(key_in: APIKeyCreate, session: Session = Depends(get_session)):
    encrypted_value = _encrypt_key(key_in.key_value)
    key = APIKey(name=key_in.name, key_value=encrypted_value)
    session.add(key)
    session.commit()
    session.refresh(key)
    
    # If it's the first key, make it active
    settings = session.exec(select(Settings)).first()
    if settings and not settings.active_api_key_id:
        settings.active_api_key_id = key.id
        session.add(settings)
        session.commit()
        
    return {"message": "Key added", "id": key.id}

@router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: int, session: Session = Depends(get_session)):
    key = session.get(APIKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
        
    settings = session.exec(select(Settings)).first()
    if settings and settings.active_api_key_id == key_id:
        # We need to pick another key to be active
        other_key = session.exec(select(APIKey).where(APIKey.id != key_id)).first()
        settings.active_api_key_id = other_key.id if other_key else None
        session.add(settings)
        
    session.delete(key)
    session.commit()
    return {"message": "Key deleted"}

@router.post("/api-keys/{key_id}/activate")
def activate_api_key(key_id: int, session: Session = Depends(get_session)):
    key = session.get(APIKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
        
    settings = session.exec(select(Settings)).first()
    if not settings:
        settings = Settings(active_api_key_id=key_id)
    else:
        settings.active_api_key_id = key_id
        
    session.add(settings)
    
    # Reset exhausted status if user manually activates
    key.is_exhausted = False
    session.add(key)
    
    session.commit()
    return {"message": "Key activated"}

@router.get("/", response_model=SettingsResponse)
def get_settings(session: Session = Depends(get_session)):
    settings = session.exec(select(Settings)).first()
    if not settings:
        settings = Settings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings
