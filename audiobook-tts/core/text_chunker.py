import re
from typing import List

def chunk_text(text: str, max_chars: int = 7000) -> List[str]:
    """
    Chunks a large text into smaller logical scenes (approx 5-8 mins audio).
    Prefers splitting by paragraphs (\n\n), then sentences.
    """
    if not text:
        return []

    # First, split by double newlines (paragraphs)
    paragraphs = re.split(r'\n\s*\n', text)
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
            
        # If adding this paragraph exceeds the limit and we already have content
        if current_length + len(p) > max_chars and current_chunk:
            # Finalize the current chunk
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [p]
            current_length = len(p)
        else:
            current_chunk.append(p)
            current_length += len(p)
            
    # Add the last chunk
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
        
    return chunks
