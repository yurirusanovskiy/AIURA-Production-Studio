import re
from typing import List

def split_into_chapters(text: str, max_chars: int = 20000) -> List[str]:
    """
    Splits text into chapters based on explicit headings or blank-line separated short titles.
    If no chapters are found, returns the whole text as a single chunk (unless it exceeds max_chars).
    """
    if not text.strip():
        return []

    paragraphs = re.split(r'\n\s*\n', text)
    
    chapters = []
    current_chapter = []
    
    # Common chapter markers in Russian and English
    chapter_keywords = r'^(глава|chapter|часть|part|пролог|эпилог|предисловие|оглавление|содержание|введение|заключение|prologue|epilogue|foreword|introduction)\b'
    
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
            
        # 1. Starts with a known chapter keyword
        is_explicit_header = re.match(chapter_keywords, p, re.IGNORECASE) is not None and len(p) < 100
        
        # 2. Short title (ALL CAPS), no end punctuation like '.', '!', '?', length < 60
        is_caps_header = p.isupper() and len(p) < 60 and not p.endswith('.')
        
        if (is_explicit_header or is_caps_header) and current_chapter:
            # Only split if the current chapter has accumulated enough content (e.g., > 300 chars)
            # to avoid splitting front matter/author/title into tiny micro-chapters
            if sum(len(x) for x in current_chapter) > 300:
                chapters.append("\n\n".join(current_chapter))
                current_chapter = [p]
            else:
                current_chapter.append(p)
        else:
            current_chapter.append(p)
            
    if current_chapter:
        chapters.append("\n\n".join(current_chapter))
        
    # Ensure no chapter exceeds max_chars
    final_chunks = []
    for chunk in chapters:
        if len(chunk) > max_chars:
            final_chunks.extend(fallback_chunk_text(chunk, max_chars))
        else:
            final_chunks.append(chunk)
            
    return final_chunks

def fallback_chunk_text(text: str, max_chars: int) -> List[str]:
    """Simple paragraph-based chunker as a fallback for huge chapters."""
    paragraphs = re.split(r'\n\s*\n', text)
    
    # If the text uses single newlines instead of double newlines to separate paragraphs,
    # re.split(r'\n\s*\n') won't split it. We check if we should split by single newlines.
    if len(paragraphs) <= 1 or max(len(p) for p in paragraphs) > max_chars:
        # Check if there are single newlines we can split on
        single_newline_paras = text.split('\n')
        if len(single_newline_paras) > 1:
            paragraphs = [p.strip() for p in single_newline_paras if p.strip()]

    chunks = []
    current_chunk = []
    current_length = 0
    
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        # Avoid splitting if the current chunk has very little text (e.g. less than 1500 chars)
        # to prevent creating tiny micro-chapters containing only title/author/metadata
        if current_length + len(p) > max_chars and current_chunk and current_length > 1500:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [p]
            current_length = len(p)
        else:
            current_chunk.append(p)
            current_length += len(p) + 2 # +2 for \n\n
            
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
        
    return chunks
