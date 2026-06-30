import os
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Dict, Optional
from pydantic import BaseModel
from db.database import get_session
from db.models import Character, Project, ProjectCharacterLink
from core.preprocessor import PreprocessorFactory
from core.gemini_client import GeminiAudioClient
from db.crud import get_dictionary_for_language, build_line_prompt

router = APIRouter(prefix="/processing", tags=["Processing"])

class ProcessingSceneLine(BaseModel):
    character_id: Optional[str]
    text: str
    language_override: Optional[str] = None
    prompt_override: Optional[str] = None

class ProcessSceneRequest(BaseModel):
    scene_id: str

class PreprocessLinesRequest(BaseModel):
    project_id: str
    lines: List[ProcessingSceneLine]

class ProcessSceneResponse(BaseModel):
    scene_id: str
    audio_file_url: str

class ProcessedLine(BaseModel):
    character_id: Optional[str] = None
    original_text: str
    processed_text: str

class PreprocessOnlyResponse(BaseModel):
    scene_id: str
    processed_lines: List[ProcessedLine]

def _process_lines(project_id: str, lines, session: Session):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    processed_lines = []
    script = []
    
    # Cache preprocessors and dictionaries for this request
    preprocessors = {}
    dictionaries = {}
    
    for line in lines:
        if line.character_id is None:
            # Handle narrator/unassigned lines
            char = None
            lang = line.language_override if line.language_override else project.language_code
            final_line_prompt = build_line_prompt(None, line, lang, session)
        else:
            char = session.get(Character, line.character_id)
            if not char:
                raise HTTPException(status_code=404, detail=f"Character '{line.character_id}' not found in DB")
                
            link = session.get(ProjectCharacterLink, {"project_id": project_id, "character_id": line.character_id})
            if not link:
                raise HTTPException(status_code=400, detail=f"Character '{line.character_id}' is not linked to project '{project_id}'")
                
            # 1. Determine language for this line
            lang = line.language_override if line.language_override else project.language_code
            final_line_prompt = build_line_prompt(char, line, lang, session)
        
        if lang not in preprocessors:
            try:
                preprocessors[lang] = PreprocessorFactory.get_preprocessor(lang)
                dictionaries[lang] = get_dictionary_for_language(session, lang)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
                
        # Preprocess text
        processed_text = preprocessors[lang].process(line.text, dictionaries[lang])
        
        processed_lines.append(ProcessedLine(
            character_id=char.id if char else None,
            original_text=line.text,
            processed_text=processed_text
        ))
        script.append((char, processed_text, final_line_prompt))
        
    return project, script, processed_lines

@router.post("/preprocess-only", response_model=PreprocessOnlyResponse)
def preprocess_only(request: PreprocessLinesRequest, session: Session = Depends(get_session)):
    """
    Test endpoint to see how the text will be processed (dictionary + ML) 
    before sending it to the Gemini TTS engine.
    """
    _, _, processed_lines = _process_lines(request.project_id, request.lines, session)
        
    return PreprocessOnlyResponse(
        scene_id="preview",
        processed_lines=processed_lines
    )

@router.post("/process-scene", response_model=ProcessSceneResponse)
def process_scene(request: ProcessSceneRequest, session: Session = Depends(get_session)):
    from api.v1.routes.scenes import generate_audio
    
    try:
        updated_scene = generate_audio(scene_id=request.scene_id, session=session)
        return ProcessSceneResponse(
            scene_id=request.scene_id,
            audio_file_url=updated_scene.audio_url or ""
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")
