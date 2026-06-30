import re
from typing import List, Dict, Any

def normalize_and_unwrap_text(text: str) -> str:
    """
    Detects if the text is hard-wrapped (short lines separated by newlines, 
    with empty lines between paragraphs) and unwraps it into clean paragraphs 
    separated by double newlines (\\n\\n).
    """
    lines = text.split('\n')
    if len(lines) <= 5:
        return text
        
    # Heuristic to detect hard-wrapping:
    # Check lines that are not empty and see if their lengths are consistently short (e.g., < 90 chars).
    non_empty_lines = [l.strip() for l in lines if l.strip()]
    if not non_empty_lines:
        return text
        
    # Count how many lines are between 30 and 85 characters
    wrapped_candidates = [l for l in non_empty_lines if 30 <= len(l) <= 85]
    ratio = len(wrapped_candidates) / len(non_empty_lines)
    
    # If more than 50% of the lines look wrapped, we unwrap them
    if ratio > 0.5:
        unwrapped_paragraphs = []
        current_para = []
        
        for l in lines:
            l_strip = l.strip()
            if not l_strip:
                if current_para:
                    unwrapped_paragraphs.append(" ".join(current_para))
                    current_para = []
                continue
                
            # If the line looks like a header (starts with chapter keyword, or is very short and capitalised),
            # we treat it as its own paragraph boundary.
            is_header_candidate = (
                l_strip.isupper() and len(l_strip) < 60
            ) or (
                re.match(r'^(глава|chapter|часть|part|пролог|эпилог|рассказ)\b', l_strip, re.IGNORECASE) is not None
            )
            
            if is_header_candidate:
                if current_para:
                    unwrapped_paragraphs.append(" ".join(current_para))
                    current_para = []
                unwrapped_paragraphs.append(l_strip)
            else:
                current_para.append(l_strip)
                
        if current_para:
            unwrapped_paragraphs.append(" ".join(current_para))
            
        return "\n\n".join(unwrapped_paragraphs)
    else:
        # Already single-line paragraphs. Ensure they are separated by \n\n if they were separated by \n
        if "\n\n" not in text:
            return "\n\n".join(non_empty_lines)
        return text

def split_into_chapters(text: str, max_chars: int = 20000) -> List[Dict[str, Any]]:
    """
    Splits text into chapters based on explicit headings or blank-line separated short titles.
    Returns a list of dicts: [{"title": str, "content": str}]
    """
    if not text.strip():
        return []

    # Normalize and unwrap text first
    normalized_text = normalize_and_unwrap_text(text)
    
    paragraphs = normalized_text.split('\n\n')
    
    chapters = []
    current_chapter_paragraphs = []
    current_chapter_title = "Introduction" # fallback title for the first section
    
    # Common chapter markers in Russian and English
    chapter_keywords = r'^(глава|chapter|часть|part|пролог|эпилог|предисловие|оглавление|содержание|введение|заключение|prologue|epilogue|foreword|introduction|рассказ)\b'
    
    for p in paragraphs:
        p_strip = p.strip()
        if not p_strip:
            continue
            
        # Check if paragraph is a header
        # Rule A: Starts with a known chapter keyword
        is_explicit_header = re.match(chapter_keywords, p_strip, re.IGNORECASE) is not None and len(p_strip) < 100
        
        # Rule B: Numeric header (e.g. "1", "2")
        is_numeric_header = p_strip.isdigit() and len(p_strip) < 10
        
        # Rule C: Short title (ALL CAPS)
        is_caps_header = p_strip.isupper() and len(p_strip) < 60 and not p_strip.endswith('.')
        
        # Rule D: Short Title Case header (no ending punctuation, no dialogue markers)
        is_title_case_header = (
            len(p_strip) < 70 
            and len(p_strip) >= 3 
            and p_strip[0].isupper() 
            and not p_strip.startswith(('—', '-', '«', '"', '(', '[')) 
            and not p_strip.endswith(('.', ',', '!', '?', ':', ';', ')', ']'))
        )
        
        is_header = is_explicit_header or is_numeric_header or is_caps_header or is_title_case_header
        
        if is_header and current_chapter_paragraphs:
            accumulated_len = sum(len(x) for x in current_chapter_paragraphs)
            if accumulated_len > 300:
                # Save previous chapter
                chapters.append({
                    "title": current_chapter_title,
                    "content": "\n\n".join(current_chapter_paragraphs).strip()
                })
                current_chapter_title = p_strip
                current_chapter_paragraphs = [p_strip]
            else:
                # Keep accumulating, treat this header as part of the current section
                current_chapter_paragraphs.append(p)
                # Update title if the current title was a generic fallback, 
                # or if the new header is longer (likely the book/story title rather than just the author)
                if current_chapter_title == "Introduction" or len(p_strip) > len(current_chapter_title):
                    current_chapter_title = p_strip
        else:
            if is_header and not current_chapter_paragraphs:
                current_chapter_title = p_strip
            current_chapter_paragraphs.append(p)
            
    if current_chapter_paragraphs:
        chapters.append({
            "title": current_chapter_title,
            "content": "\n\n".join(current_chapter_paragraphs).strip()
        })
        
    # Ensure no chapter exceeds max_chars
    final_chapters = []
    for chapter in chapters:
        content = chapter["content"]
        title = chapter["title"]
        if len(content) > max_chars:
            parts = fallback_chunk_text(content, max_chars)
            if len(parts) <= 1:
                final_chapters.append(chapter)
            else:
                for idx, part_content in enumerate(parts):
                    final_chapters.append({
                        "title": f"{title} (Часть {idx + 1})",
                        "content": part_content
                    })
        else:
            final_chapters.append(chapter)
            
    return final_chapters

def fallback_chunk_text(text: str, max_chars: int) -> List[str]:
    """Simple paragraph-based chunker as a fallback for huge chapters."""
    paragraphs = text.split('\n\n')
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for p in paragraphs:
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
