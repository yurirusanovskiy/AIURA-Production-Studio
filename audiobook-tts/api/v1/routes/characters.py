import hashlib
import logging
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from db.database import get_session
from db.models import Character, CharacterLanguageProfile, VoiceDefinition
from core.gemini_client import GeminiAudioClient
from core.preprocessor import PreprocessorFactory

logger = logging.getLogger(__name__)

class CharacterResponse(BaseModel):
    id: str
    name: str
    voice_id: str
    prompt_style: Optional[str] = None
    gender: Optional[str] = None
    age_category: Optional[str] = None
    pitch_override: Optional[str] = None
    sample_audio_url: Optional[str] = None
    sample_prompt_hash: Optional[str] = None
    language_profiles: List[CharacterLanguageProfile] = []

router = APIRouter(prefix="/characters", tags=["Characters"])

@router.get("/", response_model=List[CharacterResponse])
def read_characters(session: Session = Depends(get_session)):
    characters = session.exec(select(Character)).all()
    return characters

@router.get("/voices", response_model=List[VoiceDefinition])
def read_voices(session: Session = Depends(get_session)):
    """Get all available system voice definitions."""
    return session.exec(select(VoiceDefinition)).all()

@router.get("/{character_id}", response_model=CharacterResponse)
def read_character(character_id: str, session: Session = Depends(get_session)):
    character = session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character

@router.post("/", response_model=CharacterResponse)
def create_character(character: Character, session: Session = Depends(get_session)):
    import uuid
    if not character.id:
        character.id = f"char_{uuid.uuid4().hex[:12]}"
    db_char = session.get(Character, character.id)
    if db_char:
        raise HTTPException(status_code=400, detail="Character with this ID already exists")

    existing_name = session.exec(select(Character).where(Character.name.ilike(character.name))).first()
    if existing_name:
        raise HTTPException(status_code=400, detail="Character with this name already exists")

    if character.voice_id:
        voice_def = session.get(VoiceDefinition, character.voice_id)
        if voice_def:
            character.gender = voice_def.gender

    session.add(character)
    session.commit()
    session.refresh(character)
    return character

class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    voice_id: Optional[str] = None
    prompt_style: Optional[str] = None
    gender: Optional[str] = None
    age_category: Optional[str] = None
    pitch_override: Optional[str] = None

@router.put("/{character_id}", response_model=CharacterResponse)
def update_character(character_id: str, char_in: CharacterUpdate, session: Session = Depends(get_session)):
    character = session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    if char_in.name is not None:
        if char_in.name != character.name:
            # #10: case-insensitive name check on update
            existing_name = session.exec(
                select(Character).where(Character.name.ilike(char_in.name))
            ).first()
            if existing_name:
                raise HTTPException(status_code=400, detail="Character with this name already exists")
        character.name = char_in.name
    if char_in.voice_id is not None:
        character.voice_id = char_in.voice_id
    if char_in.prompt_style is not None:
        character.prompt_style = char_in.prompt_style
    
    # Enforce strict gender binding.
    # If the user supplied a voice_id, fetch its gender.
    # If the user only supplied a gender but the character already has a voice_id,
    # the voice_def's gender will OVERRIDE the user's supplied gender!
    voice_def = session.get(VoiceDefinition, character.voice_id)
    if voice_def:
        character.gender = voice_def.gender
    elif char_in.gender is not None:
        # Fallback if somehow no voice_def matches (shouldn't happen with valid FKs)
        character.gender = char_in.gender

    if char_in.age_category is not None:
        character.age_category = char_in.age_category
    if char_in.pitch_override is not None:
        character.pitch_override = char_in.pitch_override
        
    session.commit()
    session.refresh(character)
    return character

@router.delete("/{character_id}")
def delete_character(character_id: str, session: Session = Depends(get_session)):
    character = session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    session.delete(character)
    session.commit()
    return {"ok": True}

@router.post("/{character_id}/language-profiles/", response_model=CharacterLanguageProfile)
def create_language_profile(character_id: str, profile: CharacterLanguageProfile, session: Session = Depends(get_session)):
    character = session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
        
    profile.character_id = character_id
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile

@router.delete("/{character_id}/language-profiles/{profile_id}")
def delete_language_profile(character_id: str, profile_id: int, session: Session = Depends(get_session)):
    profile = session.get(CharacterLanguageProfile, profile_id)
    if not profile or profile.character_id != character_id:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    session.delete(profile)
    session.commit()
    return {"ok": True}

class CharacterLanguageProfileUpdate(BaseModel):
    language_code: Optional[str] = None
    is_native: Optional[bool] = None
    accent_description: Optional[str] = None

@router.put("/{character_id}/language-profiles/{profile_id}", response_model=CharacterLanguageProfile)
def update_language_profile(character_id: str, profile_id: int, profile_in: CharacterLanguageProfileUpdate, session: Session = Depends(get_session)):
    profile = session.get(CharacterLanguageProfile, profile_id)
    if not profile or profile.character_id != character_id:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    if profile_in.language_code is not None:
        profile.language_code = profile_in.language_code
    if profile_in.is_native is not None:
        profile.is_native = profile_in.is_native
    if profile_in.accent_description is not None:
        profile.accent_description = profile_in.accent_description
        
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile

def calculate_prompt_hash(
    voice_id: str,
    gender: Optional[str],
    age: Optional[str],
    prompt: Optional[str],
    pitch: Optional[str],
) -> str:
    """Return a short, stable hash for the given voice profile parameters.

    Uses SHA-256 (stdlib) rather than a hand-rolled DJB2 to reduce collision risk.
    The result is truncated to 16 hex characters for compactness.
    """
    s = f"{voice_id or ''}|{gender or ''}|{age or ''}|{prompt or ''}|{pitch or ''}"
    return hashlib.sha256(s.encode()).hexdigest()[:16]

@router.post("/{character_id}/generate-sample", response_model=CharacterResponse)
def generate_sample(character_id: str, session: Session = Depends(get_session)):
    char = session.get(Character, character_id)
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    from core.gemini_client import GeminiAudioClient, CharacterInfo
    from core.path_utils import get_audiobooks_root_path
    from core.audio_helpers import to_relative_url

    sample_text = (
        f"Hello, I am {char.name}. "
        f"This is a preview of my voice, so you can hear how I sound."
    )
    if char.prompt_style:
        style_hint = char.prompt_style.split(",")[0].strip()
        sample_text = f"({style_hint}) {sample_text}"

    char_info = CharacterInfo(
        id=char.id,
        voice_id=char.voice_id,
        prompt_style=char.prompt_style,
        pitch_override=char.pitch_override,
        age_category=char.age_category,
        gender=char.gender,
    )

    new_hash = calculate_prompt_hash(
        char.voice_id, char.gender, char.age_category, char.prompt_style, char.pitch_override
    )

    base_dir = get_audiobooks_root_path()
    samples_dir = os.path.join(base_dir, "samples")
    os.makedirs(samples_dir, exist_ok=True)
    file_path = os.path.join(samples_dir, f"{char.id}_sample.wav")

    try:
        audio_client = GeminiAudioClient()
        audio_client.generate_audio_chunk(file_path, [(char_info, sample_text, "")], "gemini-3.1-flash-tts-preview")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample generation failed: {str(e)}")

    rel_url = to_relative_url(os.path.abspath(file_path))
    char.sample_audio_url = rel_url
    char.sample_prompt_hash = new_hash
    session.add(char)
    session.commit()
    session.refresh(char)
    return char
