from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from db.database import get_session
from db.models import DictionaryEntry

router = APIRouter(prefix="/dictionary", tags=["Dictionary"])

@router.get("/", response_model=List[DictionaryEntry])
def read_dictionary_entries(language: str = None, session: Session = Depends(get_session)):
    if language:
        statement = select(DictionaryEntry).where(DictionaryEntry.language == language)
        return session.exec(statement).all()
    return session.exec(select(DictionaryEntry)).all()

@router.post("/", response_model=DictionaryEntry)
def create_dictionary_entry(entry: DictionaryEntry, session: Session = Depends(get_session)):
    statement = select(DictionaryEntry).where(
        DictionaryEntry.word == entry.word,
        DictionaryEntry.language == entry.language
    )
    db_entry = session.exec(statement).first()
    if db_entry:
        raise HTTPException(status_code=400, detail="Entry for this word already exists")
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

@router.delete("/{entry_id}")
def delete_dictionary_entry(entry_id: int, session: Session = Depends(get_session)):
    entry = session.get(DictionaryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Dictionary entry not found")
    session.delete(entry)
    session.commit()
    return {"ok": True}

@router.put("/{entry_id}", response_model=DictionaryEntry)
def update_dictionary_entry(entry_id: int, updated_data: DictionaryEntry, session: Session = Depends(get_session)):
    entry = session.get(DictionaryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Dictionary entry not found")
    
    entry.word = updated_data.word
    entry.phonetic_replacement = updated_data.phonetic_replacement
    entry.language = updated_data.language
    
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry
