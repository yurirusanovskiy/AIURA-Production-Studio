from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
import os
import logging
from sqlmodel import Session, select, or_
from typing import List, Optional
from pydantic import BaseModel
from db.database import get_session
from db.models import Project, Character, ProjectCharacterLink, Scene, VoiceDefinition
import uuid
from datetime import datetime, timezone
from google import genai

logger = logging.getLogger(__name__)

DEFAULT_FEMALE_VOICE = "Aoede"
DEFAULT_MALE_VOICE = "Puck"

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("/stream-audio")
def stream_audio(path: str):
    """Stream an audio file. Path must be within allowed audio output directories."""
    from core.path_utils import get_audiobooks_root_path
    
    # Resolve relative paths relative to get_audiobooks_root_path()
    if not os.path.isabs(path):
        abs_path = os.path.abspath(os.path.join(get_audiobooks_root_path(), path))
    else:
        abs_path = os.path.abspath(path)
        
    # Security: only serve files from within our known audio output directories.
    # Append os.sep so that /AudioBooks_Outputs_evil/ won't match /AudioBooks_Outputs/
    allowed_bases = [
        os.path.abspath("static"),
        get_audiobooks_root_path(),
    ]
    def _is_allowed(p: str, base: str) -> bool:
        safe_base = base.rstrip(os.sep) + os.sep
        return p.startswith(safe_base) or p == base
    if not any(_is_allowed(abs_path, base) for base in allowed_bases):
        raise HTTPException(status_code=403, detail="Access denied: path is outside allowed directories")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(abs_path)


class ProjectReadWithStats(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    title: str
    language_code: str
    tts_model: str = "gemini-3.1-flash-tts-preview"
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    total_scenes: int = 0
    completed_scenes: int = 0

@router.get("/", response_model=List[ProjectReadWithStats])
def read_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project)).all()
    # Load all scenes in a single query to avoid N+1 pattern
    all_scenes = session.exec(select(Scene)).all()
    scenes_by_project: dict[str, list[Scene]] = {}
    for s in all_scenes:
        scenes_by_project.setdefault(s.project_id, []).append(s)

    results = []
    for p in projects:
        p_scenes = scenes_by_project.get(p.id, [])
        total_scenes = len(p_scenes)
        completed_scenes = sum(1 for s in p_scenes if s.status == "completed")
        p_stats = ProjectReadWithStats.model_validate(p)
        p_stats.total_scenes = total_scenes
        p_stats.completed_scenes = completed_scenes
        results.append(p_stats)
    return results

@router.post("/", response_model=Project)
def create_project(project: Project, session: Session = Depends(get_session)):
    if not project.id:
        project.id = f"project_{uuid.uuid4().hex[:8]}"
        
    db_project = session.get(Project, project.id)
    if db_project:
        raise HTTPException(status_code=400, detail="Project with this ID already exists")
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.get("/{project_id}", response_model=Project)
def read_project(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    language_code: Optional[str] = None
    tts_model: Optional[str] = None
    description: Optional[str] = None

@router.put("/{project_id}", response_model=Project)
def update_project(project_id: str, project_in: ProjectUpdate, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project_in.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if k in ["title", "language_code", "tts_model", "description"]:
            setattr(project, k, v)
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project

@router.delete("/{project_id}")
def delete_project(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    session.delete(project)
    session.commit()
    return {"ok": True, "message": "Project and all associated scenes deleted"}

class ProjectCharacterResponse(BaseModel):
    """A Character enriched with a project-specific alias. Uses plain BaseModel
    to avoid inheriting SQLAlchemy Mapped relationship fields from the table class."""
    id: str
    name: str
    voice_id: str
    prompt_style: Optional[str] = None
    pitch_override: Optional[str] = None
    gender: Optional[str] = None
    age_category: Optional[str] = None
    sample_audio_url: Optional[str] = None
    alias: Optional[str] = None


def get_project_characters_with_aliases(project: Project, session: Session) -> List[ProjectCharacterResponse]:
    char_ids = [char.id for char in project.characters]
    if not char_ids:
        return []
    links = session.exec(
        select(ProjectCharacterLink).where(
            ProjectCharacterLink.project_id == project.id,
            ProjectCharacterLink.character_id.in_(char_ids)
        )
    ).all()
    link_map = {lnk.character_id: lnk for lnk in links}
    results = []
    for char in project.characters:
        lnk = link_map.get(char.id)
        char_dict = {
            "id": char.id,
            "name": char.name,
            "voice_id": char.voice_id,
            "prompt_style": char.prompt_style,
            "pitch_override": char.pitch_override,
            "gender": char.gender,
            "age_category": char.age_category,
            "sample_audio_url": char.sample_audio_url,
            "alias": lnk.alias if lnk else None,
        }
        results.append(ProjectCharacterResponse(**char_dict))
    return results

@router.get("/{project_id}/characters", response_model=List[ProjectCharacterResponse])
def read_project_characters(project_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return get_project_characters_with_aliases(project, session)

class DiscoverCharactersRequest(BaseModel):
    raw_text: str

class CharacterDiscoverySuggestion(BaseModel):
    discovered_name: str
    traits: str
    gender: str
    age_category: str
    action: str  # "create_new" or "use_existing"
    existing_character_id: Optional[str] = None
    suggested_voice_id: Optional[str] = None
    suggested_pitch_override: Optional[str] = None

@router.post("/{project_id}/characters/discover", response_model=List[CharacterDiscoverySuggestion])
def discover_characters(project_id: str, req: DiscoverCharactersRequest, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 1. Ask Gemini to discover characters in the text
    from core.gemini_client import GeminiTextClient
    client = GeminiTextClient()
    try:
        discovered_chars = client.discover_characters(req.raw_text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API Error: {str(e)}")

    # 2. Get all characters and project links from DB
    all_db_chars = session.exec(select(Character)).all()
    project_links = session.exec(
        select(ProjectCharacterLink).where(ProjectCharacterLink.project_id == project.id)
    ).all()
    link_map = {lnk.character_id: lnk for lnk in project_links}

    used_voices = {c.voice_id for c in project.characters}
    assigned_existing_chars = set()

    # Load all system voice definitions dynamically from DB
    all_voices = session.exec(select(VoiceDefinition)).all()

    suggestions = []
    
    for d_char in discovered_chars:
        suggestion = CharacterDiscoverySuggestion(
            discovered_name=d_char.discovered_name,
            traits=d_char.traits,
            gender=d_char.gender,
            age_category=d_char.age_category,
            action="create_new"
        )

        d_name_lower = d_char.discovered_name.strip().lower()
        is_narrator_char = "narrator" in d_name_lower or "рассказчик" in d_name_lower
        best_match = None

        if is_narrator_char:
            # Search project characters for narrator first
            for char in project.characters:
                lnk = link_map.get(char.id)
                char_alias = lnk.alias if lnk else None
                if (
                    "narrator" in char.name.lower() or 
                    "рассказчик" in char.name.lower() or
                    (char_alias and ("narrator" in char_alias.lower() or "рассказчик" in char_alias.lower()))
                ):
                    best_match = char
                    break
            # Search DB for global narrator if not in project
            if not best_match:
                for db_char in all_db_chars:
                    if "narrator" in db_char.name.lower() or "рассказчик" in db_char.name.lower():
                        best_match = db_char
                        break
        else:
            # 1. Match by name/alias case-insensitively AND matching characteristics
            # Check project characters first
            for char in project.characters:
                lnk = link_map.get(char.id)
                char_name = char.name.strip().lower()
                char_alias = lnk.alias.strip().lower() if (lnk and lnk.alias) else None
                if char_name == d_name_lower or char_alias == d_name_lower:
                    if (
                        (char.gender or "").strip().lower() == (d_char.gender or "").strip().lower() and
                        (char.age_category or "").strip().lower() == (d_char.age_category or "").strip().lower()
                    ):
                        best_match = char
                        break
            
            # Check global characters next
            if not best_match:
                for db_char in all_db_chars:
                    db_char_name = db_char.name.strip().lower()
                    if db_char_name == d_name_lower:
                        if (
                            (db_char.gender or "").strip().lower() == (d_char.gender or "").strip().lower() and
                            (db_char.age_category or "").strip().lower() == (d_char.age_category or "").strip().lower()
                        ):
                            best_match = db_char
                            break

            # 2. If no match with traits, match by name/alias only to avoid creating a duplicate character
            if not best_match:
                for char in project.characters:
                    lnk = link_map.get(char.id)
                    char_name = char.name.strip().lower()
                    char_alias = lnk.alias.strip().lower() if (lnk and lnk.alias) else None
                    if char_name == d_name_lower or char_alias == d_name_lower:
                        best_match = char
                        break

            if not best_match:
                for db_char in all_db_chars:
                    db_char_name = db_char.name.strip().lower()
                    if db_char_name == d_name_lower:
                        best_match = db_char
                        break

        if best_match:
            suggestion.action = "use_existing"
            suggestion.existing_character_id = best_match.id
            assigned_existing_chars.add(best_match.id)
            if getattr(best_match, "voice_id", None):
                used_voices.add(best_match.voice_id)
        else:
            suggestion.action = "create_new"
            # Strictly match by gender first (case insensitive)
            target_gender = d_char.gender.lower() if d_char.gender else "male"
            
            # Find voices of this gender
            all_gender_voices = [v.id for v in all_voices if v.gender.lower() == target_gender]
            
            if not all_gender_voices:
                # Extreme fallback if DB is completely broken and has no voices for this gender
                suggestion.suggested_voice_id = DEFAULT_FEMALE_VOICE if target_gender == "female" else DEFAULT_MALE_VOICE
            else:
                # Find unused voices of this gender
                unused_gender_voices = [v_id for v_id in all_gender_voices if v_id not in used_voices]
                
                if unused_gender_voices:
                    # Pick an unused voice of the correct gender
                    chosen_voice = unused_gender_voices[0]
                    suggestion.suggested_voice_id = chosen_voice
                    used_voices.add(chosen_voice)
                else:
                    # All voices of this gender are used, we MUST re-use one of the correct gender
                    # rather than picking an unused voice of the WRONG gender!
                    import random
                    chosen_voice = random.choice(all_gender_voices)
                    suggestion.suggested_voice_id = chosen_voice
                    
                    # Apply a pitch override based on traits to differentiate it
                    traits_lower = d_char.traits.lower() if d_char.traits else ""
                    if any(w in traits_lower for w in ["old", "deep", "gruff", "large", "giant", "monster", "heavy", "dark", "stern", "старый", "глубокий", "грубый", "огромный", "монстр", "тяжелый", "темный", "строгий"]):
                        suggestion.suggested_pitch_override = "-3st"
                    elif any(w in traits_lower for w in ["young", "child", "small", "high", "squeaky", "light", "mouse", "sweet", "молодой", "ребенок", "маленький", "высокий", "писклявый", "светлый", "мышь", "милый"]):
                        suggestion.suggested_pitch_override = "+3st"
                    else:
                        suggestion.suggested_pitch_override = random.choice(["-2st", "-1st", "+1st", "+2st"])

        suggestions.append(suggestion)

    # 3. Always ensure the Narrator is included in the suggestions
    has_narrator = any("narrator" in s.discovered_name.lower() or "рассказчик" in s.discovered_name.lower() for s in suggestions)
    
    if not has_narrator:
        # Check if project already has a linked narrator
        narrator_link = None
        for char in project.characters:
            lnk = link_map.get(char.id)
            char_alias = lnk.alias if lnk else None
            if (
                "narrator" in char.name.lower() or 
                "рассказчик" in char.name.lower() or
                (char_alias and ("narrator" in char_alias.lower() or "рассказчик" in char_alias.lower()))
            ):
                narrator_link = char
                break
                
        if narrator_link:
            suggestions.insert(0, CharacterDiscoverySuggestion(
                discovered_name="Narrator",
                traits="The voice telling the story",
                gender=narrator_link.gender or "male",
                age_category=narrator_link.age_category or "adult",
                action="use_existing",
                existing_character_id=narrator_link.id
            ))
        else:
            # Check for a global narrator in DB
            global_narrator = None
            for db_char in all_db_chars:
                if "narrator" in db_char.name.lower() or "рассказчик" in db_char.name.lower():
                    global_narrator = db_char
                    break

            if global_narrator:
                suggestions.insert(0, CharacterDiscoverySuggestion(
                    discovered_name="Narrator",
                    traits="The voice telling the story",
                    gender=global_narrator.gender or "male",
                    age_category=global_narrator.age_category or "adult",
                    action="use_existing",
                    existing_character_id=global_narrator.id
                ))
            else:
                suggestions.insert(0, CharacterDiscoverySuggestion(
                    discovered_name="Narrator",
                    traits="The voice telling the story",
                    gender="male",
                    age_category="adult",
                    action="create_new",
                    suggested_voice_id=DEFAULT_MALE_VOICE
                ))

    return suggestions

class BatchSaveCharactersRequest(BaseModel):
    suggestions: List[CharacterDiscoverySuggestion]

@router.post("/{project_id}/characters/batch")
def batch_save_characters(project_id: str, req: BatchSaveCharactersRequest, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for suggestion in req.suggestions:
        if suggestion.action == "use_existing" and suggestion.existing_character_id:
            char = session.get(Character, suggestion.existing_character_id)
            if char:
                link = session.get(ProjectCharacterLink, (project_id, char.id))
                if not link:
                    link = ProjectCharacterLink(
                        project_id=project_id,
                        character_id=char.id,
                        alias=suggestion.discovered_name
                    )
                    session.add(link)
                else:
                    # Update alias on existing link — must call session.add() so
                    # SQLModel/SQLAlchemy marks the row as dirty and includes it in commit.
                    link.alias = suggestion.discovered_name
                    session.add(link)
        elif suggestion.action == "create_new":
            new_id = str(uuid.uuid4())
            # We trust the LLM's gender guess more than its voice_id guess.
            target_gender = suggestion.gender or "male"
            voice_id_to_use = suggestion.suggested_voice_id or "Kore"
            
            # Verify the suggested voice matches the target gender
            voice_def = session.get(VoiceDefinition, voice_id_to_use)
            if not voice_def or voice_def.gender != target_gender:
                # Find the first voice that matches the target gender
                matching_voice = session.exec(
                    select(VoiceDefinition).where(VoiceDefinition.gender == target_gender)
                ).first()
                if matching_voice:
                    voice_id_to_use = matching_voice.id
                    voice_def = matching_voice
            
            resolved_gender = voice_def.gender if voice_def else target_gender

            char = Character(
                id=new_id,
                name=suggestion.discovered_name,
                voice_id=voice_id_to_use,
                prompt_style=suggestion.traits,
                gender=resolved_gender,
                age_category=suggestion.age_category,
                pitch_override=suggestion.suggested_pitch_override
            )
            session.add(char)
            # Create link explicitly so we can set alias to match name initially
            link = ProjectCharacterLink(
                project_id=project_id,
                character_id=char.id,
                alias=suggestion.discovered_name
            )
            session.add(link)
            
    session.commit()
    return {"ok": True, "message": f"Saved {len(req.suggestions)} characters to project"}

class SwapCharacterRequest(BaseModel):
    old_character_id: str
    new_character_id: str

@router.post("/{project_id}/characters/swap")
def swap_character_in_project(project_id: str, req: SwapCharacterRequest, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 1. Link new character to project if not already linked
    new_char_link = session.get(ProjectCharacterLink, {"project_id": project_id, "character_id": req.new_character_id})
    if not new_char_link:
        session.add(ProjectCharacterLink(project_id=project_id, character_id=req.new_character_id))
    
    # 2. Update all SceneLines that belong to this project and have old_character_id
    from db.models import Scene, SceneLine
    stmt = select(SceneLine).join(Scene).where(
        Scene.project_id == project_id,
        SceneLine.character_id == req.old_character_id
    )
    lines_to_update = session.exec(stmt).all()
    for line in lines_to_update:
        line.character_id = req.new_character_id
        session.add(line)
        
    # 3. Unlink old character
    old_char_link = session.get(ProjectCharacterLink, {"project_id": project_id, "character_id": req.old_character_id})
    if old_char_link:
        session.delete(old_char_link)
        
    session.commit()
    return {"ok": True, "message": f"Swapped character and updated {len(lines_to_update)} lines"}

@router.post("/{project_id}/characters/{character_id}")
def link_character_to_project(project_id: str, character_id: str, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    character = session.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
        
    link = session.get(ProjectCharacterLink, {"project_id": project_id, "character_id": character_id})
    if link:
        return {"ok": True, "message": "Already linked"}
        
    new_link = ProjectCharacterLink(project_id=project_id, character_id=character_id)
    session.add(new_link)
    session.commit()
    return {"ok": True, "message": "Character linked to project"}

@router.delete("/{project_id}/characters/{character_id}")
def unlink_character_from_project(project_id: str, character_id: str, session: Session = Depends(get_session)):
    link = session.get(ProjectCharacterLink, {"project_id": project_id, "character_id": character_id})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
        
    session.delete(link)
    session.commit()
    return {"ok": True, "message": "Character unlinked from project"}

class AliasUpdateRequest(BaseModel):
    alias: Optional[str] = None  # None = clear the alias

@router.put("/{project_id}/characters/{character_id}/alias")
def update_character_alias(project_id: str, character_id: str, req: AliasUpdateRequest, session: Session = Depends(get_session)):
    link = session.get(ProjectCharacterLink, {"project_id": project_id, "character_id": character_id})
    if not link:
        raise HTTPException(status_code=404, detail="Character not linked to project")
        
    link.alias = req.alias
    session.add(link)
    session.commit()
    return {"ok": True, "message": "Alias updated successfully"}


@router.post("/{project_id}/upload-book")
async def upload_book(project_id: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Uploads a book file, extracts text, chunks it, and creates Scenes."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    content_bytes = await file.read()
    
    from core.file_parser import parse_uploaded_file
    raw_text = parse_uploaded_file(file.filename, content_bytes)
        
    from core.chapter_splitter import split_into_chapters
    chunks = split_into_chapters(raw_text, max_chars=20000)
    
    # Calculate next order index for scenes
    existing_scenes = session.exec(select(Scene).where(Scene.project_id == project_id)).all()
    next_order = max((s.order_index for s in existing_scenes), default=-1) + 1
    
    created_count = 0
    for chunk_data in chunks:
        scene_id = f"scene_{uuid.uuid4().hex[:8]}"
        scene_title = chunk_data.get("title") or f"Chapter {next_order + created_count + 1}"
        scene = Scene(
            id=scene_id,
            project_id=project_id,
            title=scene_title,
            order_index=next_order + created_count,
            raw_text=chunk_data["content"]
        )
        session.add(scene)
        created_count += 1
        
    session.commit()
    
    return {
        "ok": True, 
        "message": f"Successfully chunked book into {created_count} scenes.",
        "scenes_created": created_count
    }



