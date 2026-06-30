# AI Agent Specification: Movie Dubbing & Video Game Localization Extensions

This document provides architectural patterns, specifications, and guidelines for future AI agents/developers when implementing Movie Dubbing (via Subtitles) and Video Game Localization features in AIURA Production Studio.

---

## 🎬 Use Case 1: Movie Dubbing & Video Translation (SRT/ASS Integration)

Dubbing movies or translating videos requires aligning synthesized speech to specific timestamps in a video/audio track.

### 1. Data Schema
To represent subtitle-based scenes, the database will store subtitle segments instead of book chapters.
```python
class SubtitleLine(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scene_id: str = Field(foreign_key="scene.id")
    character_id: Optional[str] = Field(default=None, foreign_key="character.id")
    
    # Subtitle specific timing fields
    start_time: float  # In seconds (e.g., 12.340)
    end_time: float    # In seconds (e.g., 15.680)
    
    text: str
    phonetic_text: Optional[str] = None
    audio_url: Optional[str] = None
```

### 2. Audio Generation Pipeline
1. **Timing Validation**:
   - Calculate duration: `max_duration = end_time - start_time`.
   - Compute character/word counts. If a line has too many words for its duration, warn the user that speech speed must be accelerated.
2. **Speed Adjustment**:
   - When calling the Gemini TTS API, use the duration details.
   - If the generated audio clip is longer than `max_duration`, use an audio speed adjustment utility (e.g., `pydub`'s `speedup` effect or `time_stretch` in librosa) to compress the clip to fit exactly within the subtitle timeframe.
3. **Stitching (Timeline Assembly)**:
   - Instead of stitching files end-to-end, the stitcher must create a silent master audio track of length `video_duration`.
   - Overlay each subtitle's generated audio at its specific `start_time` offset.

---

## 🎮 Use Case 2: Video Game Localization & Dialog Voicing

Game localization requires bulk-generating thousands of individual character lines (takes) organized by localization keys.

### 1. Data Schema & Spreadsheet Import
1. **Import Format**: Allow CSV/XLSX uploads in the format:
   `Key | Speaker_ID | Text | Accent_Override | Context_Prompt`
   *Example:* `LOC_NPCSMITH_GREET | smith_voice | Welcome to my forge! | Russian | Enthusiastic`
2. **Key-Based File Generation**:
   - The database maps the `order_index` to the localization key:
   ```python
   class GameDialogueLine(SQLModel, table=True):
       id: Optional[int] = Field(default=None, primary_key=True)
       loc_key: str = Field(unique=True, index=True) # e.g. "LOC_NPCSMITH_GREET"
       character_id: str = Field(foreign_key="character.id")
       text: str
       audio_url: Optional[str] = None
   ```

### 2. Batch Export & Integration
- Unlike audiobook chapters that are stitched into a single WAV, game dialogs are exported as **individual audio assets**.
- **Exporter Utility**: Create a batch exporter that zips all active takes, naming each file by its localization key (e.g., `LOC_NPCSMITH_GREET.wav`) and organizing them in directories matching the character IDs.

---

## 🤖 Instructions for AI Coding Agents

When tasked with implementing these features:
1. **Preserve Casting System**: Use the existing `Character` and `VoiceDefinition` DB tables. The casting director dashboard must remain the single source of truth for character voices.
2. **FastAPI Route Additions**:
   - Create `/api/v1/routes/subtitles.py` for parsing SRT files. Use `pysubs2` or `srt` library for parsing timings.
   - Create `/api/v1/routes/localization.py` for CSV/XLSX imports and key-based zip exports.
3. **Pydub Audio Overlay**: Use `AudioSegment.overlay(position=start_ms)` to overlay audio clips at precise offsets when compiling subtitle tracks.
4. **UI Adaptation**:
   - Add a subtitle timeline view in the client showing waveform timestamps.
   - Add a bulk spreadsheet-editor view for localization keys.
