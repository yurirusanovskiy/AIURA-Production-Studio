from typing import Optional, List
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, DateTime, UniqueConstraint

class ProjectCharacterLink(SQLModel, table=True):
    project_id: str = Field(foreign_key="project.id", primary_key=True)
    character_id: str = Field(foreign_key="character.id", primary_key=True)
    alias: Optional[str] = Field(default=None, description="The name of the character in this specific project (e.g. 'Bill' for global character 'Sindbad')")

class Project(SQLModel, table=True):
    id: str = Field(primary_key=True, description="Unique identifier for the project, e.g., 'harry_potter_1'")
    title: str = Field(index=True, description="Human-readable title of the book/project")
    language_code: str = Field(default="ru-RU", description="Default language of the project")
    tts_model: str = Field(default="gemini-3.1-flash-tts-preview", description="The Gemini TTS model to use for audio generation")
    description: Optional[str] = Field(default=None, description="A description of the project")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    )

    characters: List["Character"] = Relationship(back_populates="projects", link_model=ProjectCharacterLink)
    scenes: List["Scene"] = Relationship(back_populates="project", cascade_delete=True)

class Scene(SQLModel, table=True):
    id: str = Field(primary_key=True, description="Unique identifier for the scene, e.g., 'scene_01'")
    project_id: str = Field(foreign_key="project.id", index=True)
    title: Optional[str] = Field(default=None, description="Human-readable title of the scene/chapter")
    order_index: int = Field(default=0, description="Order of the scene within the project")
    status: str = Field(default="draft", description="Status of the scene (draft, extracted, completed, error)")
    audio_url: Optional[str] = Field(default=None, description="Path to the generated audio file")
    raw_text: Optional[str] = Field(default=None, description="Raw text chunk for this scene before script extraction")
    
    project: Project = Relationship(back_populates="scenes")
    lines: List["SceneLine"] = Relationship(back_populates="scene", cascade_delete=True)

class LineAudioTake(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scene_line_id: int = Field(foreign_key="sceneline.id", index=True)
    audio_url: str = Field(description="URL to the generated audio file")
    take_number: int = Field(default=1, description="Sequential take number")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    scene_line: "SceneLine" = Relationship(back_populates="audio_takes")

class SceneLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scene_id: str = Field(foreign_key="scene.id", index=True)
    character_id: Optional[str] = Field(foreign_key="character.id", index=True, description="Character speaking, null if narrator")
    text: str = Field(description="The text to be spoken")
    phonetic_text: Optional[str] = Field(default=None, description="The ruaccent processed text or manually edited phonetic text")
    language_override: Optional[str] = Field(default=None, description="Override the language for this specific line")
    prompt_override: Optional[str] = Field(default=None, description="Override the acting prompt for this specific line")
    order_index: int = Field(default=0, description="Order of the line within the scene")
    is_manual_phonetics: bool = Field(default=False, description="Whether phonetics have been manually edited, bypassing ruaccent during generation")
    audio_url: Optional[str] = Field(default=None, description="URL to the generated audio for just this line")
    
    scene: Scene = Relationship(back_populates="lines")
    character: Optional["Character"] = Relationship(back_populates="lines")
    audio_takes: List[LineAudioTake] = Relationship(back_populates="scene_line", cascade_delete=True)

class CharacterLanguageProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    character_id: str = Field(foreign_key="character.id", index=True)
    language_code: str = Field(index=True, description="The language this profile applies to (e.g., 'ru-RU')")
    is_native: bool = Field(default=True, description="True if the character speaks this language perfectly")
    accent_description: Optional[str] = Field(default=None, description="e.g., 'Speaks with a heavy French accent'")
    
    character: "Character" = Relationship(back_populates="language_profiles")

class Character(SQLModel, table=True):
    id: str = Field(
        primary_key=True, 
        description="Unique identifier for the character, used in YAML files (e.g., 'alex', 'ai_core')"
    )
    name: str = Field(
        index=True, 
        description="Display name of the character for UI/Logs"
    )
    voice_id: str = Field(description="Gemini prebuilt voice name, e.g. 'Kore' or 'Puck'")
    prompt_style: Optional[str] = Field(default=None, description="Natural language instructions for the TTS model, e.g. 'Read fast and cheerfully'")
    pitch_override: Optional[str] = Field(default=None, description="Pitch modification instruction, e.g. 'High', 'Low', 'Deep', 'Squeaky'")
    gender: Optional[str] = Field(default=None, description="Gender of the character: 'male' or 'female'")
    age_category: Optional[str] = Field(default=None, description="Age category: 'child', 'young', 'adult', 'elderly'")
    sample_audio_url: Optional[str] = Field(default=None, description="URL to the generated voice sample audio")
    sample_prompt_hash: Optional[str] = Field(default=None, description="Hash of the settings used to generate the sample audio")
    
    projects: List[Project] = Relationship(back_populates="characters", link_model=ProjectCharacterLink)
    language_profiles: List[CharacterLanguageProfile] = Relationship(back_populates="character")
    lines: List[SceneLine] = Relationship(back_populates="character")

class DictionaryEntry(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("language", "word", name="uq_dictionary_entry_language_word"),
    )

    id: Optional[int] = Field(
        default=None, 
        primary_key=True
    )
    language: str = Field(
        index=True, 
        description="Language code to prevent rules leaking across languages (e.g., 'ru', 'ro')"
    )
    word: str = Field(
        index=True, 
        description="The original word/phrase to be replaced"
    )
    phonetic_replacement: str = Field(
        description="The phonetic pronunciation or custom replacement"
    )

class APIKey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(description="Name of the key owner, e.g., 'Wife', 'Son'")
    key_value: str = Field(description="The actual API key")
    is_exhausted: bool = Field(default=False, description="Flagged if 429 quota reached")
    exhausted_until: Optional[datetime] = Field(default=None)

class Settings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    active_api_key_id: Optional[int] = Field(foreign_key="apikey.id", default=None)

class VoiceDefinition(SQLModel, table=True):
    id: str = Field(primary_key=True, description="Voice ID/name, e.g. 'Aoede'")
    gender: str = Field(description="Gender of the voice: 'male' or 'female'")
    sample_audio_url: Optional[str] = Field(default=None, description="Path to local sample audio file relative to root path")

