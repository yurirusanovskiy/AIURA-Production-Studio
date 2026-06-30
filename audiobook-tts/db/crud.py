from typing import Dict, List, Optional
from sqlmodel import Session, select
from db.models import DictionaryEntry, Character, SceneLine, CharacterLanguageProfile

def get_dictionary_for_language(session: Session, language_code: str) -> Dict[str, str]:
    """
    Fetches all dictionary entries for a specific language and returns them as a key-value mapping.
    The language_code is expected to be either a full locale (e.g., 'ru-RU') or just the prefix ('ru').
    We match based on the language prefix to keep things simple.
    """
    prefix = language_code.lower().split('-')[0]
    
    statement = select(DictionaryEntry).where(DictionaryEntry.language.startswith(prefix))
    results = session.exec(statement).all()
    
    return {entry.word: entry.phonetic_replacement for entry in results}

def get_available_dictionary_languages(session: Session) -> List[str]:
    """
    Returns a list of unique language codes that currently have entries in the dictionary.
    Useful for the frontend to show which languages have custom rules.
    """
    statement = select(DictionaryEntry.language).distinct()
    results = session.exec(statement).all()
    
    return list(results)

def build_line_prompt(char: Optional[Character], line: SceneLine, lang: str, session: Session) -> str:
    """
    Builds the dynamic prompt instruction for a given character and scene line,
    incorporating voice style, pitch override, accent profile, and expression overrides.
    """
    if not char:
        return line.prompt_override or ""
        
    parts = []
    if char.prompt_style:
        parts.append(f"Voice style: {char.prompt_style}")
        
    if line.prompt_override:
        parts.append(f"Expression: {line.prompt_override}")
        
    if getattr(char, 'age_category', None) or getattr(char, 'gender', None):
        traits = [t for t in [getattr(char, 'age_category', None), getattr(char, 'gender', None)] if t]
        parts.append(f"Voice traits: {', '.join(traits)}")
        
    if char.pitch_override:
        parts.append(f"Voice pitch: {char.pitch_override}")
        
    line_lang = line.language_override if line.language_override else lang
    prefix = line_lang.lower().split('-')[0]
    profile = session.exec(select(CharacterLanguageProfile).where(
        CharacterLanguageProfile.character_id == char.id,
        CharacterLanguageProfile.language_code.startswith(prefix)
    )).first()
    
    if profile and not profile.is_native and profile.accent_description:
        parts.append(profile.accent_description)
        
    return ". ".join(parts).strip()
