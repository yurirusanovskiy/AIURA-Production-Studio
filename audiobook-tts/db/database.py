import os
import shutil
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session

# Import models to ensure they are registered with SQLModel's metadata
from db.models import Character, DictionaryEntry, APIKey, Settings, VoiceDefinition
import dotenv
from core.path_utils import get_audiobooks_root_path

dotenv.load_dotenv()

def get_db_path():
    root_path = get_audiobooks_root_path()
        
    base_dir = os.path.join(root_path, ".database")
    os.makedirs(base_dir, exist_ok=True)
    return os.path.join(base_dir, "audiobook_core.db")

# Perform migration if old db exists in local project directory
local_db_path = "audiobook_core.db"
target_db_path = get_db_path()

if os.path.exists(local_db_path) and not os.path.exists(target_db_path):
    print(f"Migrating local database to {target_db_path}...")
    shutil.copy2(local_db_path, target_db_path)
    os.rename(local_db_path, local_db_path + ".backup") # backup instead of delete just in case

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{target_db_path}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def create_db_and_tables():
    """Create all tables in the database if they don't exist yet."""
    SQLModel.metadata.create_all(engine)
    
    # Initialize default settings if needed
    with Session(engine) as session:
        settings = session.query(Settings).first()
        if not settings:
            settings = Settings()
            session.add(settings)
            session.commit()

def reinit_engine():
    global engine, target_db_path, DATABASE_URL
    engine.dispose()
    target_db_path = get_db_path()
    DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{target_db_path}")
    connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)
    create_db_and_tables()

def get_session() -> Generator[Session, None, None]:
    """Dependency for getting a database session."""
    with Session(engine) as session:
        yield session
