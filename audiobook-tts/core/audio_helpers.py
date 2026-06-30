"""
core/audio_helpers.py
----------------------
Shared helpers for audio generation routes to avoid code duplication.
"""

import logging
import os
from typing import Optional
from sqlmodel import Session, select
from db.models import SceneLine, DictionaryEntry
from core.preprocessor import PreprocessorFactory
from core.path_utils import get_audiobooks_root_path

logger = logging.getLogger(__name__)


def preprocess_line_text(
    line: SceneLine,
    project_lang: str,
    session: Session,
    dictionary: Optional[dict] = None,
) -> str:
    """
    Determine the final TTS-ready text for *line*, applying the phonetic
    preprocessor and user dictionary.

    Resolution order:
    1. If ``line.is_manual_phonetics`` is True, use ``phonetic_text`` (or fall
       back to the raw ``text`` if phonetic_text is empty).
    2. Otherwise run the language-appropriate preprocessor + dictionary.

    A per-line language override is respected: if ``line.language_override`` is
    set and differs from *project_lang*, the appropriate preprocessor and
    dictionary for that language are loaded.

    ``dictionary`` can be pre-loaded by the caller to avoid N+1 DB queries when
    processing many lines in a loop. When ``None`` the dictionary is loaded from
    the DB (single-call path).
    """
    if line.is_manual_phonetics:
        return line.phonetic_text if line.phonetic_text else line.text

    line_lang = line.language_override if line.language_override else project_lang

    # If the line has a language override that differs from the project language,
    # do not use the pre-loaded project-language dictionary.
    if line.language_override and line.language_override != project_lang:
        dictionary = None

    if dictionary is None:
        prefix = line_lang.lower().split("-")[0]
        dict_entries = session.exec(
            select(DictionaryEntry).where(DictionaryEntry.language.startswith(prefix))
        ).all()
        dictionary = {e.word: e.phonetic_replacement for e in dict_entries}

    preprocessor = PreprocessorFactory.get_preprocessor(line_lang)
    return preprocessor.process(line.text, dictionary)


def to_relative_url(absolute_path: str, query: str = "") -> str:
    """
    Convert *absolute_path* to a path relative to the audiobooks root so that
    it can be stored in the DB without machine-specific absolute paths.

    ``query`` is the raw query string (without leading '?') to preserve cache-
    busting suffixes such as ``v=<timestamp>``.
    """
    root = get_audiobooks_root_path()
    try:
        rel = os.path.relpath(absolute_path, root)
    except ValueError:
        # On Windows, relpath raises ValueError if paths are on different drives.
        rel = absolute_path
    return (rel + "?" + query) if query else rel
