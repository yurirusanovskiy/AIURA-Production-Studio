import sqlite3
import os

DB_PATH = os.environ.get("DATABASE_URL", "sqlite:///audiobook_core.db").replace("sqlite:///", "")

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(project)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if "storage_path" not in columns:
        print("Adding storage_path column to project table...")
        cursor.execute("ALTER TABLE project ADD COLUMN storage_path VARCHAR")
        conn.commit()
        print("Migration successful.")
    else:
        print("Column storage_path already exists.")
        
    conn.close()

if __name__ == "__main__":
    migrate()
