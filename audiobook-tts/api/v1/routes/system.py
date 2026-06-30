from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import shutil
import dotenv
from core.path_utils import get_audiobooks_root_path

router = APIRouter(prefix="/system", tags=["System"])

class StorageConfigRequest(BaseModel):
    root_path: str

@router.get("/storage")
def get_storage_config():
    return {"root_path": get_audiobooks_root_path()}

@router.post("/storage")
def update_storage_config(config: StorageConfigRequest):
    new_path = os.path.expanduser(config.root_path)
    
    if not os.path.isabs(new_path):
        raise HTTPException(status_code=400, detail="Path must be an absolute path")
        
    old_path = get_audiobooks_root_path()
    
    if os.path.abspath(new_path) == os.path.abspath(old_path):
        return {"success": True, "message": "Path is already set to this location"}
        
    try:
        # 1. Create new directory if it doesn't exist
        os.makedirs(new_path, exist_ok=True)
        
        # 2. Copy only relevant files/folders from old path to new path if old path exists
        if os.path.exists(old_path):
            # Only copy .database, samples, and project_* folders
            allowed_items = [".database", "samples"]
            for item in os.listdir(old_path):
                if item in allowed_items or item.startswith("project_"):
                    s = os.path.join(old_path, item)
                    d = os.path.join(new_path, item)
                    if os.path.isdir(s):
                        if not os.path.exists(d):
                            shutil.copytree(s, d)
                    else:
                        if not os.path.exists(d):
                            shutil.copy2(s, d)
                        
        # 3. Update .env
        dotenv_file = dotenv.find_dotenv()
        if not dotenv_file:
            dotenv_file = ".env"
            with open(dotenv_file, "w") as f:
                f.write("")
                
        dotenv.set_key(dotenv_file, "AUDIOBOOKS_ROOT_PATH", new_path)
        os.environ["AUDIOBOOKS_ROOT_PATH"] = new_path
        
        # 4. Reinitialize database engine
        from db.database import reinit_engine
        reinit_engine()
        
        return {"success": True, "message": "Storage path updated successfully and files migrated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to migrate storage: {str(e)}")
