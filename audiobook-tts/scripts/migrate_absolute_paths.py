"""
scripts/migrate_absolute_paths.py
-----------------------------------
One-time migration: convert absolute audio_url paths stored in the DB to
paths relative to get_audiobooks_root_path().

Affected columns:
  - SceneLine.audio_url
  - LineAudioTake.audio_url
  - Scene.audio_url
  - Character.sample_audio_url

Run with:
    uv run python scripts/migrate_absolute_paths.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import dotenv
dotenv.load_dotenv()

from sqlmodel import Session, select
from db.database import engine
from db.models import SceneLine, LineAudioTake, Scene, Character
from core.path_utils import get_audiobooks_root_path

def to_relative(url: str, root: str) -> str:
    """Convert an absolute path (with optional ?v=...) to a root-relative path."""
    if not url:
        return url
    path, _, query = url.partition("?")
    abs_root = os.path.abspath(root) + os.sep
    abs_path = os.path.abspath(path)
    if abs_path.startswith(abs_root):
        rel = os.path.relpath(abs_path, root)
        return (rel + "?" + query) if query else rel
    return url  # already relative or outside root — leave unchanged

def run():
    root = get_audiobooks_root_path()
    print(f"=== Migrating absolute audio paths (root: {root}) ===\n")

    total = 0

    with Session(engine) as sess:
        # SceneLine.audio_url
        for line in sess.exec(select(SceneLine)).all():
            if line.audio_url and os.path.isabs(line.audio_url.split("?")[0]):
                new_url = to_relative(line.audio_url, root)
                if new_url != line.audio_url:
                    line.audio_url = new_url
                    sess.add(line)
                    total += 1

        # LineAudioTake.audio_url
        for take in sess.exec(select(LineAudioTake)).all():
            if take.audio_url and os.path.isabs(take.audio_url.split("?")[0]):
                new_url = to_relative(take.audio_url, root)
                if new_url != take.audio_url:
                    take.audio_url = new_url
                    sess.add(take)
                    total += 1

        # Scene.audio_url
        for scene in sess.exec(select(Scene)).all():
            if scene.audio_url and os.path.isabs(scene.audio_url.split("?")[0]):
                new_url = to_relative(scene.audio_url, root)
                if new_url != scene.audio_url:
                    scene.audio_url = new_url
                    sess.add(scene)
                    total += 1

        # Character.sample_audio_url
        for char in sess.exec(select(Character)).all():
            if char.sample_audio_url and os.path.isabs(char.sample_audio_url.split("?")[0]):
                new_url = to_relative(char.sample_audio_url, root)
                if new_url != char.sample_audio_url:
                    char.sample_audio_url = new_url
                    sess.add(char)
                    total += 1

        if total:
            sess.commit()
            print(f"✅ Migrated {total} record(s) from absolute → relative paths.")
        else:
            print("✅ Nothing to migrate — all paths already relative.")

if __name__ == "__main__":
    run()
