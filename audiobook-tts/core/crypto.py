"""
core/crypto.py
--------------
Fernet symmetric encryption for storing sensitive values (API keys) at rest.

The encryption key is loaded from the FIELD_ENCRYPT_KEY environment variable.
If the variable is absent, a new key is auto-generated, written to .env, and
used for the lifetime of the process.

Usage:
    from core.crypto import encrypt, decrypt

    stored  = encrypt("AIza-real-api-key")   # store this in DB
    plain   = decrypt(stored)                  # returns "AIza-real-api-key"

Both functions are idempotent:
    encrypt(encrypt(x)) == encrypt(x)
    decrypt(plaintext)  == plaintext   (non-Fernet values pass through)
"""

import os
import base64
import dotenv
import logging

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None

# Fernet tokens always start with this prefix after base64-decoding the version byte
_FERNET_PREFIX = "gAAAAA"


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet

    raw_key = os.environ.get("FIELD_ENCRYPT_KEY", "")

    if raw_key:
        try:
            _fernet = Fernet(raw_key.encode())
            return _fernet
        except Exception:
            logger.warning("FIELD_ENCRYPT_KEY is invalid — generating a new key.")

    # Auto-generate and persist
    new_key = Fernet.generate_key()
    raw_key = new_key.decode()

    dotenv_file = dotenv.find_dotenv()
    if not dotenv_file:
        dotenv_file = ".env"
    dotenv.set_key(dotenv_file, "FIELD_ENCRYPT_KEY", raw_key)
    os.environ["FIELD_ENCRYPT_KEY"] = raw_key

    logger.info("Generated new FIELD_ENCRYPT_KEY and saved to %s", dotenv_file)
    _fernet = Fernet(new_key)
    return _fernet


def encrypt(plain: str) -> str:
    """Encrypt *plain* and return a Fernet token string.

    Idempotent: already-encrypted values are returned unchanged.
    """
    if not plain:
        return plain
    if plain.startswith(_FERNET_PREFIX):
        return plain  # already encrypted
    token = _get_fernet().encrypt(plain.encode())
    return token.decode()


def decrypt(token: str) -> str:
    """Decrypt a Fernet *token* and return the plaintext.

    Idempotent: plaintext values that are not valid Fernet tokens are
    returned as-is so that existing un-migrated keys keep working.
    """
    if not token:
        return token
    if not token.startswith(_FERNET_PREFIX):
        return token  # plaintext pass-through (legacy / not yet migrated)
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        logger.error("Failed to decrypt token — returning as-is")
        return token
