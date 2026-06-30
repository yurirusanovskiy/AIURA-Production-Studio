# AIURA Production Studio — Backend Engine

This is the FastAPI backend engine for **AIURA Production Studio**. It manages database persistence, text preprocessing, phonetic transcription, and handles the multi-character voice generation via the Google Gemini TTS API.

## 🚀 Key Features

- **RESTful API**: Clean REST APIs for managing books, scenes (chapters), cast definitions, and pronunciation dictionary entries.
- **Phonetic Transcription (ruaccent)**: Integrates `ruaccent` to parse Russian sentences and automatically inject stress marks to improve TTS pronunciation.
- **Gemini Multi-Speaker TTS**: Uses Gemini TTS model parameters to generate fluid multi-character dialogs directly in a single API pass, eliminating voice synchronization issues.
- **WAV Stitching**: Uses `pydub` to merge individual dialogue stem takes and normalize audio volumes into high-quality master chapter recordings.
- **Portability**: Database relative path resolution allows running the backend on any platform or inside Docker without rewriting file locations.

## 🛠 Tech Stack

- **Framework**: FastAPI (Python 3.12)
- **Database Layer**: SQLModel (SQLAlchemy) & SQLite
- **Audio Processing**: PyDub (FFmpeg dependency)
- **NLP / Accents**: RuAccent (ONNX runtimes)
- **Package Management**: Astral `uv`

## 📦 Local Installation

### Prerequisites
- Python 3.12+
- `uv` Python package manager
- `ffmpeg` (system audio utility)

### Steps
1. Sync environment and install dependencies:
   ```bash
   uv sync
   ```
2. Run database schema upgrades:
   ```bash
   uv run alembic upgrade head
   ```
3. Start the engine:
   ```bash
   uv run uvicorn main:app --reload --reload-exclude '*.db'
   ```

The API docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs).
