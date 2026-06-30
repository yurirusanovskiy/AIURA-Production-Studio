"""
scripts/migrate_plaintext_keys.py
----------------------------------
One-time migration: encrypt any API key values that are still stored as
plaintext in the database.

Run with:
    uv run python scripts/migrate_plaintext_keys.py
"""

import sys
import os

# Add project root to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import dotenv
dotenv.load_dotenv()

from sqlmodel import Session, select
from db.database import engine
from db.models import APIKey
from core.crypto import encrypt, decrypt

def run():
    print("=== Migrating plaintext API keys to encrypted storage ===\n")
    migrated = 0
    skipped = 0

    with Session(engine) as sess:
        keys = sess.exec(select(APIKey)).all()
        for key in keys:
            decrypted = decrypt(key.key_value)
            re_encrypted = encrypt(decrypted)
            if re_encrypted != key.key_value:
                print(f"  Encrypting key '{key.name}' (id={key.id}) ...")
                key.key_value = re_encrypted
                sess.add(key)
                migrated += 1
            else:
                print(f"  Skipping key '{key.name}' (id={key.id}) — already encrypted.")
                skipped += 1

        if migrated:
            sess.commit()
            print(f"\n✅ Done. {migrated} key(s) encrypted, {skipped} key(s) skipped.")
        else:
            print(f"\n✅ Nothing to migrate. All {skipped} key(s) were already encrypted.")

if __name__ == "__main__":
    run()
