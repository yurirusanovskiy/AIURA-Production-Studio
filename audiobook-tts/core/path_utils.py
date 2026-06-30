import os
import dotenv

dotenv.load_dotenv()

def get_audiobooks_root_path() -> str:
    """Returns the global root path for all AudioBooks data."""
    root_path = os.environ.get("AUDIOBOOKS_ROOT_PATH")
    if not root_path:
        root_path = os.path.join(os.path.expanduser("~/Documents"), "AudioBooks_Outputs")
    return root_path

def get_audiobooks_samples_dir() -> str:
    """Returns the global directory for character voice samples."""
    return os.path.join(get_audiobooks_root_path(), "samples")

def get_audiobooks_voice_samples_dir() -> str:
    """Returns the global directory for system prebuilt voice samples."""
    return os.path.join(get_audiobooks_samples_dir(), "voices")

