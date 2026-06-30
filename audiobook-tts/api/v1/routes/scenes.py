from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from pydantic import BaseModel
import asyncio
import hashlib
import logging
import os
import re
import shutil
import time
import traceback
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime

from db.database import get_session, engine as db_engine
from db.models import (
    LineAudioTake, Scene, SceneLine, Project, Character,
    DictionaryEntry, ProjectCharacterLink, CharacterLanguageProfile
)
from core.gemini_client import GeminiTextClient, GeminiAudioClient, RateLimitExhaustedError, CharacterInfo
from core.preprocessor import PreprocessorFactory
from core.audio_helpers import preprocess_line_text, to_relative_url
from core.audio_utils import stitch_wavs
from core.path_utils import get_audiobooks_root_path
from db.crud import build_line_prompt
from api.v1.routes.projects import get_project_characters_with_aliases

logger = logging.getLogger(__name__)

DEFAULT_FEMALE_VOICE = "Aoede"
DEFAULT_MALE_VOICE = "Puck"

MAX_WORDS_SENTENCE_SPLIT = 150
MAX_WORDS_API_CHUNK = 150

_NARRATOR_KEYWORDS = {"narrator", "рассказчик", "автор", "author"}


def _resolve_narrator(
    project: Project, session: Session
) -> "CharacterInfo | NarratorFallback":
    for c in project.characters:
        lnk = session.get(ProjectCharacterLink, (project.id, c.id))
        char_alias = lnk.alias.lower() if (lnk and lnk.alias) else ""
        if any(kw in c.name.lower() for kw in _NARRATOR_KEYWORDS) or any(
            kw in char_alias for kw in _NARRATOR_KEYWORDS
        ):
            return CharacterInfo(
                id=c.id,
                voice_id=c.voice_id,
                prompt_style=c.prompt_style,
                pitch_override=c.pitch_override,
                age_category=c.age_category,
                gender=c.gender,
            )

    global_narrator = session.exec(
        select(Character).where(
            Character.name.in_(list(_NARRATOR_KEYWORDS))
        )
    ).first()
    if not global_narrator:
        for c in session.exec(select(Character)).all():
            if any(kw in c.name.lower() for kw in _NARRATOR_KEYWORDS):
                global_narrator = c
                break

    if global_narrator:
        return CharacterInfo(
            id=global_narrator.id,
            voice_id=global_narrator.voice_id,
            prompt_style=global_narrator.prompt_style,
            pitch_override=global_narrator.pitch_override,
            age_category=global_narrator.age_category,
            gender=global_narrator.gender,
        )

    return NarratorFallback()


@dataclass
class NarratorFallback:
    id: str = "narrator"
    name: str = "Narrator"
    voice_id: str = DEFAULT_MALE_VOICE
    prompt_style: Optional[str] = "Calm and clear"
    pitch_override: Optional[str] = None
    age_category: Optional[str] = "adult"
    gender: Optional[str] = "male"


class SceneLineCreate(BaseModel):
    character_id: Optional[str] = None
    text: str
    phonetic_text: Optional[str] = None
    language_override: Optional[str] = None
    prompt_override: Optional[str] = None
    is_manual_phonetics: bool = False

class SceneCreate(BaseModel):
    title: str
    lines: List[SceneLineCreate]

router = APIRouter()

class GenerateFromTextRequest(BaseModel):
    title: str
    raw_text: str

class StitchLineItem(BaseModel):
    id: int
    audio_url: Optional[str] = None

class StitchSceneRequest(BaseModel):
    lines: Optional[List[StitchLineItem]] = None

class LineAudioTakeResponse(BaseModel):
    id: int
    audio_url: str
    take_number: int
    created_at: datetime

class SceneLineResponse(BaseModel):
    id: int
    scene_id: str
    character_id: Optional[str]
    text: str
    phonetic_text: Optional[str]
    language_override: Optional[str]
    prompt_override: Optional[str]
    order_index: int
    is_manual_phonetics: bool
    audio_url: Optional[str]
    audio_takes: List[LineAudioTakeResponse] = []

class SceneResponse(BaseModel):
    id: str
    project_id: str
    title: Optional[str]
    order_index: int
    status: str
    raw_text: Optional[str]
    audio_url: Optional[str]

class SceneDetailResponse(SceneResponse):
    lines: List[SceneLineResponse]

@router.get("/projects/{project_id}/scenes", response_model=List[SceneResponse])
def get_project_scenes(project_id: str, session: Session = Depends(get_session)):
    """List all scenes for a project, ordered by order_index."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    scenes = session.exec(select(Scene).where(Scene.project_id == project_id).order_by(Scene.order_index)).all()
    return scenes

@router.post("/projects/{project_id}/scenes", response_model=SceneDetailResponse)
def create_scene(project_id: str, scene_in: SceneCreate, session: Session = Depends(get_session)):
    """Create a new scene with its lines for a project."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scene_id = f"scene_{uuid.uuid4().hex[:8]}"
    
    # Calculate next order index
    scenes = session.exec(select(Scene).where(Scene.project_id == project_id)).all()
    next_order = max([s.order_index for s in scenes] + [-1]) + 1
    
    scene = Scene(
        id=scene_id,
        project_id=project_id,
        title=scene_in.title,
        order_index=next_order
    )
    session.add(scene)
    
    for i, line_in in enumerate(scene_in.lines):
        line = SceneLine(
            scene_id=scene_id,
            character_id=line_in.character_id,
            text=line_in.text,
            language_override=line_in.language_override,
            prompt_override=line_in.prompt_override,
            order_index=i
        )
        session.add(line)
        
    session.commit()
    session.refresh(scene)
    return scene

@router.post("/projects/{project_id}/scenes/generate-from-text", response_model=SceneDetailResponse)
def generate_scene_from_text(project_id: str, request: GenerateFromTextRequest, session: Session = Depends(get_session)):
    """Automatically extracts script from raw text using Gemini 3.5 Flash and creates a scene."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    characters_with_alias = get_project_characters_with_aliases(project, session)
    
    text_client = GeminiTextClient()
    try:
        extracted_lines = text_client.extract_script_from_text(request.raw_text, characters_with_alias)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Convert ExtractedLine to SceneLineCreate
    scene_lines = []
    for line in extracted_lines:
        scene_lines.append(SceneLineCreate(
            character_id=line.character_id,
            text=line.text,
            prompt_override=line.prompt_override,
            language_override=line.language_override
        ))
        
    scene_in = SceneCreate(
        title=request.title,
        lines=scene_lines
    )
    
    return create_scene(project_id, scene_in, session)

@router.get("/scenes/{scene_id}", response_model=SceneDetailResponse)
def get_scene(scene_id: str, session: Session = Depends(get_session)):
    """Get a specific scene and its lines."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    # ensure lines are ordered
    scene.lines = sorted(scene.lines, key=lambda l: l.order_index)
    return scene

@router.post("/scenes/{scene_id}/extract", response_model=SceneDetailResponse)
def extract_script(scene_id: str, session: Session = Depends(get_session)):
    """Extract script from existing scene's raw_text."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    if not scene.raw_text:
        raise HTTPException(status_code=400, detail="Scene has no raw text")
        
    project = session.get(Project, scene.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    characters_with_alias = get_project_characters_with_aliases(project, session)

    valid_character_ids = {c.id for c in characters_with_alias}
    if not valid_character_ids:
        raise HTTPException(status_code=400, detail="Please add at least one character (e.g., Narrator) to the project before extracting.")

    text_client = GeminiTextClient()
    try:
        extracted_lines = text_client.extract_script_from_text(scene.raw_text, characters_with_alias)
    except RateLimitExhaustedError as e:
        scene.status = "error"
        session.commit()
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        scene.status = "error"
        session.commit()
        error_msg = str(e)
        if "All models and retries failed" in error_msg:
            raise HTTPException(status_code=429, detail="API rate limit exceeded. Please wait a minute and try again.")
        raise HTTPException(status_code=500, detail=error_msg)
        
    # Find the fallback character (Narrator) for this project
    fallback_char_id = None
    for c in characters_with_alias:
        name = (c.alias or c.name).lower()
        if name in ["narrator", "рассказчик", "автор", "author"]:
            fallback_char_id = c.id
            break
            
    if not fallback_char_id:
        # Just use the first character as fallback if Gemini hallucinates
        fallback_char_id = characters_with_alias[0].id

    # Delete old lines if any
    for line in scene.lines:
        session.delete(line)
        
    for i, line in enumerate(extracted_lines):
        cid = line.character_id
        if cid not in valid_character_ids:
            cid = fallback_char_id
            
        scene_line = SceneLine(
            scene_id=scene_id,
            character_id=cid,
            text=line.text,
            prompt_override=line.prompt_override,
            language_override=line.language_override,
            order_index=i
        )
        session.add(scene_line)
        
    scene.status = "extracted"
    session.commit()
    session.refresh(scene)
    scene.lines = sorted(scene.lines, key=lambda l: l.order_index)
    return scene

class SceneLineUpdate(BaseModel):
    id: Optional[int] = None
    character_id: Optional[str] = None
    text: str
    phonetic_text: Optional[str] = None
    language_override: Optional[str] = None
    prompt_override: Optional[str] = None
    is_manual_phonetics: bool = False
    audio_url: Optional[str] = None

class SceneUpdate(BaseModel):
    title: Optional[str] = None
    raw_text: Optional[str] = None
    lines: Optional[List[SceneLineUpdate]] = None

@router.put("/scenes/{scene_id}", response_model=SceneDetailResponse)
def update_scene(scene_id: str, scene_in: SceneUpdate, session: Session = Depends(get_session)):
    """Update a scene's title or its lines without losing relations."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    if scene_in.title is not None:
        scene.title = scene_in.title
        
    if scene_in.raw_text is not None:
        scene.raw_text = scene_in.raw_text
        
    if scene_in.lines is not None:
        # Create a mapping of existing lines by ID
        existing_lines = {line.id: line for line in scene.lines}
        
        # Keep track of updated IDs to know which to delete
        updated_ids = set()
        
        for i, line_in in enumerate(scene_in.lines):
            if line_in.id and line_in.id in existing_lines:
                line = existing_lines[line_in.id]
                line.character_id = line_in.character_id
                line.text = line_in.text
                line.phonetic_text = line_in.phonetic_text
                line.language_override = line_in.language_override
                line.prompt_override = line_in.prompt_override
                if line_in.audio_url is not None:
                    line.audio_url = line_in.audio_url
                line.order_index = i
                line.is_manual_phonetics = line_in.is_manual_phonetics
                session.add(line)
                updated_ids.add(line_in.id)
            else:
                # Add new line
                line = SceneLine(
                    scene_id=scene_id,
                    character_id=line_in.character_id,
                    text=line_in.text,
                    audio_url=line_in.audio_url,
                    phonetic_text=line_in.phonetic_text,
                    language_override=line_in.language_override,
                    prompt_override=line_in.prompt_override,
                    order_index=i,
                    is_manual_phonetics=line_in.is_manual_phonetics
                )
                session.add(line)
                
        # Delete lines that were not in the updated list
        for line_id, line in existing_lines.items():
            if line_id not in updated_ids:
                session.delete(line)
            
    session.commit()
    session.refresh(scene)
    scene.lines = sorted(scene.lines, key=lambda l: l.order_index)
    return scene

@router.delete("/scenes/{scene_id}")
def delete_scene(scene_id: str, session: Session = Depends(get_session)):
    """Delete a scene and its lines, cleaning up disk files."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    # ── Stage 3: Delete audio files on disk ────────────────────────────────────────
    import shutil
    from core.path_utils import get_audiobooks_root_path
    
    base_dir = get_audiobooks_root_path()
    
    # 1. Delete final scene WAV
    final_scene_file = os.path.join(base_dir, f"{scene_id}.wav")
    if os.path.exists(final_scene_file):
        try:
            os.remove(final_scene_file)
            logger.info("Deleted scene master track: %s", final_scene_file)
        except Exception as e:
            logger.warning("Failed to delete scene master track: %s", e)
            
    # 2. Delete scene stems directory
    stems_dir = os.path.join(base_dir, f"{scene_id}_stems")
    if os.path.exists(stems_dir):
        try:
            shutil.rmtree(stems_dir, ignore_errors=True)
            logger.info("Deleted scene stems directory: %s", stems_dir)
        except Exception as e:
            logger.warning("Failed to delete scene stems directory: %s", e)
            
    # 3. Delete scene lines directory
    lines_dir = os.path.join(base_dir, scene.project_id, scene_id)
    if os.path.exists(lines_dir):
        try:
            shutil.rmtree(lines_dir, ignore_errors=True)
            logger.info("Deleted scene lines directory: %s", lines_dir)
        except Exception as e:
            logger.warning("Failed to delete scene lines directory: %s", e)
            
    session.delete(scene)
    session.commit()
    return {"status": "ok"}

def _build_scene_chunks(scene: Scene, session: Session) -> list[list[tuple]]:
    project = session.get(Project, scene.project_id)
    lines = sorted(scene.lines, key=lambda l: l.order_index)
    if not lines:
        return []

    lang = project.language_code

    lang_prefix = lang.lower().split("-")[0]
    dict_entries = session.exec(
        select(DictionaryEntry).where(DictionaryEntry.language.startswith(lang_prefix))
    ).all()
    shared_dictionary = {e.word: e.phonetic_replacement for e in dict_entries}

    narrator = _resolve_narrator(project, session)

    script_items = []
    for line in lines:
        processed_text = preprocess_line_text(line, lang, session, dictionary=shared_dictionary)
        raw_char = line.character
        if raw_char:
            char_info = CharacterInfo(
                id=raw_char.id,
                voice_id=raw_char.voice_id,
                prompt_style=raw_char.prompt_style,
                pitch_override=raw_char.pitch_override,
                age_category=raw_char.age_category,
                gender=raw_char.gender,
            )
        else:
            char_info = narrator
        final_prompt = build_line_prompt(raw_char or None, line, lang, session)
        script_items.append((line, char_info, processed_text, final_prompt))

    def _split_into_sentences(text: str) -> list:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    flattened_items = []
    for item in script_items:
        line, char_info, processed_text, final_prompt = item
        words = processed_text.split()
        if len(words) > MAX_WORDS_SENTENCE_SPLIT:
            sentences = _split_into_sentences(processed_text)
            current_sub_text = ""
            for sentence in sentences:
                if len((current_sub_text + " " + sentence).split()) > MAX_WORDS_SENTENCE_SPLIT and current_sub_text:
                    flattened_items.append((line, char_info, current_sub_text.strip(), final_prompt))
                    current_sub_text = sentence
                else:
                    current_sub_text = (current_sub_text + " " + sentence).strip()
            if current_sub_text:
                flattened_items.append((line, char_info, current_sub_text.strip(), final_prompt))
        else:
            flattened_items.append(item)

    # Count unique speakers in the scene to decide chunking strategy
    unique_speakers = {item[1].id for item in flattened_items}
    is_multi_character_scene = len(unique_speakers) > 2

    chunks: list = []
    current_chunk: list = []
    current_speaker_id = None
    current_word_count = 0

    for item in flattened_items:
        line, char_info, processed_text, final_prompt = item
        item_word_count = len(processed_text.split())

        # Determine if we should split the chunk before adding the current item:
        # 1. If chunk word count exceeds MAX_WORDS_API_CHUNK (250 words / ~2 minutes)
        # 2. If it's a multi-character scene (> 2 speakers) and the speaker changes
        # 3. If it's a 2-speaker scene, but adding the item would introduce a 3rd speaker
        should_split = False
        if current_chunk:
            if current_word_count + item_word_count > MAX_WORDS_API_CHUNK:
                should_split = True
            elif is_multi_character_scene and current_speaker_id != char_info.id:
                should_split = True
            else:
                chunk_speakers = {x[1].id for x in current_chunk}
                if char_info.id not in chunk_speakers and len(chunk_speakers) >= 2:
                    should_split = True

        if should_split:
            chunks.append(current_chunk)
            current_chunk = []
            current_word_count = 0

        current_chunk.append(item)
        current_speaker_id = char_info.id
        current_word_count += item_word_count

    if current_chunk:
        chunks.append(current_chunk)

    return chunks

@router.post("/scenes/{scene_id}/generate-audio", response_model=SceneDetailResponse)
async def generate_audio(scene_id: str, session: Session = Depends(get_session)):  # #4: async
    """Generate audio for a scene using Gemini TTS after preprocessing text."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = session.get(Project, scene.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not scene.lines:
        raise HTTPException(status_code=400, detail="Scene has no lines to generate audio from.")

    chunks = _build_scene_chunks(scene, session)
    tts_model = project.tts_model

    audio_client = GeminiAudioClient()
    base_dir = get_audiobooks_root_path()
    scene_dir = os.path.join(base_dir, f"{scene_id}_stems")
    os.makedirs(scene_dir, exist_ok=True)

    chunk_files = []
    try:
        for idx, chunk in enumerate(chunks):
            script = [(item[1], item[2], item[3]) for item in chunk]

            hash_input = "".join(f"{c.id}_{t}_{p}|" for c, t, p in script)
            chunk_hash = hashlib.md5(hash_input.encode()).hexdigest()
            chunk_file_path = os.path.join(scene_dir, f"{idx+1:02d}_chunk_{chunk_hash}.wav")

            if os.path.exists(chunk_file_path):
                logger.info("Chunk %d: cache hit (%s) — skipping TTS.", idx + 1, chunk_hash)
            else:
                await asyncio.to_thread(
                    audio_client.generate_audio_chunk,
                    chunk_file_path, script, tts_model
                )

            chunk_files.append(chunk_file_path)

            timestamp = int(time.time())
            abs_path = os.path.abspath(chunk_file_path)
            rel_url = to_relative_url(abs_path, query=f"v={timestamp}")  # #3: relative path
            for line, char, _, _ in chunk:
                take_exists = any(
                    os.path.abspath(t.audio_url.split("?")[0]) == abs_path
                    if os.path.isabs(t.audio_url.split("?")[0])
                    else t.audio_url.split("?")[0] == to_relative_url(abs_path)
                    for t in line.audio_takes
                )
                line.audio_url = rel_url
                if not take_exists:
                    take = LineAudioTake(
                        scene_line_id=line.id,
                        audio_url=rel_url,
                        take_number=len(line.audio_takes) + 1,
                    )
                    session.add(take)
                session.add(line)

            # Commit after each chunk to release SQLite lock
            session.commit()

        # Stitch all chunks together
        final_file_path = os.path.join(base_dir, f"{scene_id}.wav")
        await asyncio.to_thread(stitch_wavs, chunk_files, final_file_path)  # #4

    except RateLimitExhaustedError as e:
        scene.status = "error"
        session.commit()
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        scene.status = "error"
        session.commit()
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    # #3: store relative path
    scene.audio_url = to_relative_url(os.path.abspath(final_file_path), query=f"v={int(time.time())}")
    scene.status = "completed"
    session.commit()
    session.expire_all()
    session.refresh(scene)

    scene.lines = sorted(scene.lines, key=lambda l: l.order_index)
    return scene


@router.get("/scenes/{scene_id}/download-stems")
def download_scene_stems(scene_id: str, session: Session = Depends(get_session)):
    """Downloads all generated stems for a scene as a ZIP file."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    if scene.audio_url:
        audio_path = scene.audio_url.split("?")[0]
        if audio_path.startswith("/static/"):
            audio_path = os.path.abspath(audio_path[1:])
        elif not os.path.isabs(audio_path):
            from core.path_utils import get_audiobooks_root_path
            audio_path = os.path.abspath(os.path.join(get_audiobooks_root_path(), audio_path))
        base_dir = os.path.dirname(audio_path)
    else:
        from core.path_utils import get_audiobooks_root_path
        base_dir = get_audiobooks_root_path()
        
    scene_dir = os.path.join(base_dir, f"{scene_id}_stems")
    if not os.path.exists(scene_dir) or not os.listdir(scene_dir):
        raise HTTPException(status_code=404, detail="Stems not found for this scene. Please generate audio first.")
        
    zip_path = os.path.join(base_dir, f"{scene_id}_stems.zip")
    
    # Create zip file
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(scene_dir):
            for file in files:
                if file.endswith('.wav'):
                    file_path = os.path.join(root, file)
                    zipf.write(file_path, arcname=file)
                    
    return FileResponse(
        path=zip_path, 
        filename=f"{scene_id}_stems.zip", 
        media_type='application/zip'
    )

@router.get("/scenes/{scene_id}/download-full")
def download_scene_full(scene_id: str, session: Session = Depends(get_session)):
    """Downloads the full stitched audio for a scene as a WAV file."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    if not scene.audio_url:
        raise HTTPException(status_code=404, detail="Audio not generated for this scene yet.")
        
    # The audio_url might have ?v=... attached, so we strip it.
    audio_path = scene.audio_url.split("?")[0]
    
    if audio_path.startswith("/static/"):
        # Convert relative web URL to absolute filesystem path
        audio_path = os.path.abspath(audio_path[1:])
    elif not os.path.isabs(audio_path):
        from core.path_utils import get_audiobooks_root_path
        audio_path = os.path.abspath(os.path.join(get_audiobooks_root_path(), audio_path))
        
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk.")
        
    filename = f"Scene_{scene.order_index + 1 if scene.order_index is not None else scene_id}.wav"
        
    return FileResponse(
        path=audio_path,
        filename=filename,
        media_type='audio/wav'
    )

@router.post("/scenes/{scene_id}/lines/{line_id}/generate-audio", response_model=SceneLineResponse)
async def generate_line_audio(scene_id: str, line_id: int, session: Session = Depends(get_session)):  # #4: async
    """Generate audio for a single replica (isolated) using Gemini TTS."""
    line = session.get(SceneLine, line_id)
    if not line or line.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="Line not found")

    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    project = session.get(Project, scene.project_id)
    lang = project.language_code

    processed_text = preprocess_line_text(line, lang, session)  # #6: deduped helper

    # Resolve narrator fallback if character is not assigned
    char = line.character
    if char is None:
        char_info = _resolve_narrator(project, session)
    else:
        char_info = CharacterInfo(
            id=char.id,
            voice_id=char.voice_id,
            prompt_style=char.prompt_style,
            pitch_override=char.pitch_override,
            age_category=char.age_category,
            gender=char.gender,
        )

    char_obj = line.character
    final_prompt = build_line_prompt(char_obj, line, lang, session)
    script = [(char_info, processed_text, final_prompt)]
    tts_model = scene.project.tts_model

    audio_client = GeminiAudioClient()
    base_dir = get_audiobooks_root_path()
    scene_dir = os.path.join(base_dir, scene.project_id, scene_id)
    os.makedirs(scene_dir, exist_ok=True)

    take_number = len(line.audio_takes) + 1
    timestamp = int(time.time())
    file_path = os.path.join(scene_dir, f"line_{line_id}_replica_{timestamp}_take{take_number}.wav")

    try:
        await asyncio.to_thread(
            audio_client.generate_audio_chunk, file_path, script, tts_model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    # #3: store relative path
    rel_url = to_relative_url(os.path.abspath(file_path), query=f"v={timestamp}")
    line.audio_url = rel_url
    take = LineAudioTake(scene_line_id=line.id, audio_url=rel_url, take_number=take_number)
    session.add(take)
    session.add(line)
    session.commit()
    session.refresh(line)

    all_generated = all(l.audio_url is not None for l in scene.lines)
    if all_generated:
        if scene.status != "completed":
            scene.status = "completed"
            session.add(scene)
            session.commit()
    else:
        if scene.status == "error":
            scene.status = "draft"
            session.add(scene)
            session.commit()

    return line

@router.post("/scenes/{scene_id}/lines/{line_id}/generate-chunk-audio", response_model=SceneDetailResponse)
async def generate_chunk_audio(scene_id: str, line_id: int, session: Session = Depends(get_session)):  # #4: async
    """Generate audio for the full chunk containing this line, bypassing hash cache to create a new take."""
    line = session.get(SceneLine, line_id)
    if not line or line.scene_id != scene_id:
        raise HTTPException(status_code=404, detail="Line not found")

    scene = session.get(Scene, scene_id)
    chunks = _build_scene_chunks(scene, session)

    target_chunk = None
    target_idx = -1
    for idx, chunk in enumerate(chunks):
        if any(item[0].id == line_id for item in chunk):
            target_chunk = chunk
            target_idx = idx
            break

    if not target_chunk:
        raise HTTPException(status_code=500, detail="Line not found in any chunk")

    audio_client = GeminiAudioClient()
    base_dir = get_audiobooks_root_path()
    scene_dir = os.path.join(base_dir, scene.project_id, scene_id)
    os.makedirs(scene_dir, exist_ok=True)

    script = [(item[1], item[2], item[3]) for item in target_chunk]
    speakers_in_chunk = sorted({c.id for _, c, _, _ in target_chunk})
    speakers_str = "_and_".join(speakers_in_chunk)
    tts_model = scene.project.tts_model

    timestamp = int(time.time())
    chunk_file_path = os.path.join(
        scene_dir, f"{target_idx+1:02d}_{scene_id}_{speakers_str}_chunk_{timestamp}.wav"
    )

    try:
        await asyncio.to_thread(
            audio_client.generate_audio_chunk, chunk_file_path, script, tts_model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

    # #3: store relative path
    rel_url = to_relative_url(os.path.abspath(chunk_file_path), query=f"v={timestamp}")

    for chunk_line, _, _, _ in target_chunk:
        chunk_line.audio_url = rel_url
        take = LineAudioTake(
            scene_line_id=chunk_line.id,
            audio_url=rel_url,
            take_number=len(chunk_line.audio_takes) + 1,
        )
        session.add(take)
        session.add(chunk_line)

    all_generated = all(l.audio_url is not None for l in scene.lines)
    if all_generated:
        if scene.status != "completed":
            scene.status = "completed"
            session.add(scene)
    else:
        if scene.status == "error":
            scene.status = "draft"
            session.add(scene)

    session.commit()
    session.expire_all()
    session.refresh(scene)
    return scene

@router.post("/scenes/{scene_id}/stitch", response_model=SceneDetailResponse)
async def stitch_scene(
    scene_id: str,
    request: Optional[StitchSceneRequest] = None,
    session: Session = Depends(get_session)
):
    """Stitch existing audio chunks/takes without generating new audio."""
    scene = session.get(Scene, scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = session.get(Project, scene.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update SceneLine.audio_url if lines/takes were sent in the request body
    if request and request.lines:
        for item in request.lines:
            line = session.get(SceneLine, item.id)
            if line and line.scene_id == scene_id:
                line.audio_url = item.audio_url
                session.add(line)
        session.commit()
        session.refresh(scene)

    lines = sorted(scene.lines, key=lambda l: l.order_index)
    if not lines:
        raise HTTPException(status_code=400, detail="Scene has no lines to stitch.")

    # Validate that every single line has a selected take
    missing_audio_lines = [l.order_index for l in lines if not l.audio_url]
    if missing_audio_lines:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot stitch: The following lines (by order index) do not have audio takes: {missing_audio_lines}"
        )

    base_dir = get_audiobooks_root_path()

    # 1. Resolve each line to its selected audio URL (chunk or replica take)
    line_chunk_urls = {}
    for l in lines:
        url_part = l.audio_url.split('?')[0] if l.audio_url else None
        if not url_part:
            continue

        line_chunk_urls[l.id] = url_part

    # 2. Group consecutive lines by their resolved chunk prefix
    blocks = []
    current_chunk_prefix = None
    current_block_lines = []

    for l in lines:
        url_part = line_chunk_urls.get(l.id)
        if not url_part:
            continue

        filename = os.path.basename(url_part)
        match = re.match(r'^(\d+_)', filename)
        prefix = match.group(1) if match else f"replica_{l.id}"

        if prefix == current_chunk_prefix:
            current_block_lines.append(l)
        else:
            if current_block_lines:
                blocks.append((current_chunk_prefix, current_block_lines))
            current_chunk_prefix = prefix
            current_block_lines = [l]

    if current_block_lines:
        blocks.append((current_chunk_prefix, current_block_lines))

    # 3. Resolve each block to a single chunk file path
    chunk_files: list[str] = []
    last_path: str | None = None
    missing_files: list[str] = []

    for prefix, block_lines in blocks:
        # Get all unique chunk URLs in this block
        block_urls = [line_chunk_urls[l.id] for l in block_lines if l.id in line_chunk_urls]
        unique_urls = list(set(block_urls))

        if not unique_urls:
            continue

        if len(unique_urls) == 1:
            resolved_url = unique_urls[0]
        else:
            # Resolve conflict: pick the one with the highest take number in the DB
            line_ids = [l.id for l in block_lines]
            takes = session.exec(
                select(LineAudioTake).where(LineAudioTake.scene_line_id.in_(line_ids))
            ).all()

            url_to_take = {}
            for t in takes:
                clean_t_url = t.audio_url.split('?')[0]
                if clean_t_url not in url_to_take or t.take_number > url_to_take[clean_t_url]:
                    url_to_take[clean_t_url] = t.take_number

            best_url = None
            best_take_num = -1
            for url in unique_urls:
                take_num = url_to_take.get(url, 1)
                if take_num > best_take_num:
                    best_take_num = take_num
                    best_url = url
            resolved_url = best_url or unique_urls[0]

        # Resolve to absolute path
        abs_path = resolved_url
        if not os.path.isabs(abs_path):
            abs_path = os.path.join(base_dir, abs_path)

        # Deduplicate consecutive identical files
        if abs_path == last_path:
            continue

        if os.path.exists(abs_path):
            chunk_files.append(abs_path)
            last_path = abs_path
        else:
            missing_files.append(resolved_url)

    if missing_files:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot stitch: {len(missing_files)} chunk file(s) are missing on disk: {missing_files}"
        )

    if not chunk_files:
        raise HTTPException(status_code=400, detail="No audio chunks available to stitch.")

    # Explicitly delete the old master track file if it exists, to reassemble from scratch
    final_scene_file = os.path.join(base_dir, f"{scene_id}.wav")
    if os.path.exists(final_scene_file):
        try:
            os.remove(final_scene_file)
            logger.info("Deleted old master track: %s", final_scene_file)
        except Exception as e:
            logger.warning("Failed to delete existing master track %s: %s", final_scene_file, e)

    # Stitch the audio segments
    await asyncio.to_thread(stitch_wavs, chunk_files, final_scene_file)

    # Store relative path and mark as completed
    scene.audio_url = to_relative_url(
        os.path.abspath(final_scene_file), query=f"v={int(time.time())}"
    )
    scene.status = "completed"

    session.add(scene)
    session.commit()
    session.refresh(scene)
    scene.lines = sorted(scene.lines, key=lambda l: l.order_index)
    
    return scene
