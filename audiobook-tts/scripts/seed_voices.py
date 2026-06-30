import os
import sys
import urllib.request
import logging

# Ensure parent directory is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import dotenv
dotenv.load_dotenv()

from sqlmodel import Session, select
from db.database import engine
from db.models import VoiceDefinition
from core.path_utils import get_audiobooks_voice_samples_dir
from core.audio_helpers import to_relative_url

logger = logging.getLogger(__name__)

VOICES_DATA = [
    {"id": "Achernar", "gender": "female"},
    {"id": "Achird", "gender": "male"},
    {"id": "Algenib", "gender": "male"},
    {"id": "Algieba", "gender": "male"},
    {"id": "Alnilam", "gender": "male"},
    {"id": "Aoede", "gender": "female", "filename": "chirp3-hd-aoeda.wav"},
    {"id": "Autonoe", "gender": "female"},
    {"id": "Callirrhoe", "gender": "female"},
    {"id": "Charon", "gender": "male"},
    {"id": "Despina", "gender": "female"},
    {"id": "Enceladus", "gender": "male"},
    {"id": "Erinome", "gender": "female"},
    {"id": "Fenrir", "gender": "male"},
    {"id": "Gacrux", "gender": "female"},
    {"id": "Iapetus", "gender": "male"},
    {"id": "Kore", "gender": "female"},
    {"id": "Laomedeia", "gender": "female"},
    {"id": "Leda", "gender": "female"},
    {"id": "Orus", "gender": "male"},
    {"id": "Pulcherrima", "gender": "female"},
    {"id": "Puck", "gender": "male"},
    {"id": "Rasalgethi", "gender": "male"},
    {"id": "Sadachbia", "gender": "male"},
    {"id": "Sadaltager", "gender": "male"},
    {"id": "Schedar", "gender": "male"},
    {"id": "Sulafat", "gender": "female"},
    {"id": "Umbriel", "gender": "male"},
    {"id": "Vindemiatrix", "gender": "female"},
    {"id": "Zephyr", "gender": "female"},
    {"id": "Zubenelgenubi", "gender": "male"},
]

def seed_voices(session: Session):
    print("=== Seeding Gemini TTS Prebuilt Voices ===")
    
    samples_dir = get_audiobooks_voice_samples_dir()
    os.makedirs(samples_dir, exist_ok=True)
    
    success_count = 0
    
    for voice_item in VOICES_DATA:
        voice_id = voice_item["id"]
        gender = voice_item["gender"]
        filename = voice_item.get("filename", f"chirp3-hd-{voice_id.lower()}.wav")
        url = f"https://docs.cloud.google.com/static/text-to-speech/docs/audio/{filename}"
        
        filepath = os.path.join(samples_dir, f"{voice_id}.wav")
        
        # Download if doesn't exist
        if not os.path.exists(filepath):
            print(f"Downloading sample for {voice_id} from {url}...")
            try:
                # Use a custom User-Agent to prevent 403 blocks from Google
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                )
                with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
                    out_file.write(response.read())
                print(f"Downloaded {voice_id}.wav successfully.")
            except Exception as e:
                print(f"⚠️ Failed to download sample for {voice_id} from {url}: {e}")
                # We still want to add to DB even if download fails
        
        # Determine stored relative path
        rel_path = to_relative_url(os.path.abspath(filepath))
        
        # Check if already in DB
        db_voice = session.get(VoiceDefinition, voice_id)
        if not db_voice:
            db_voice = VoiceDefinition(
                id=voice_id,
                gender=gender,
                sample_audio_url=rel_path
            )
            session.add(db_voice)
            success_count += 1
        else:
            # Update fields in case they changed
            db_voice.gender = gender
            db_voice.sample_audio_url = rel_path
            session.add(db_voice)
            
    session.commit()
    print(f"Successfully seeded {success_count} new voice definitions in database.\n")

if __name__ == "__main__":
    with Session(engine) as sess:
        seed_voices(sess)
