import io
import os
import tempfile
from fastapi import HTTPException

try:
    from pypdf import PdfReader
    from docx import Document
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup
except ImportError:
    pass  # Allow tests to pass if not installed, but these should be installed

def extract_text_from_txt(file_bytes: bytes) -> str:
    try:
        return file_bytes.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Text file must be UTF-8 encoded")

def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        text_chunks = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_chunks.append(text)
        return "\n".join(text_chunks)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")

def extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        doc = Document(io.BytesIO(file_bytes))
        text_chunks = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n".join(text_chunks)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {str(e)}")

def extract_text_from_epub(file_bytes: bytes) -> str:
    # ebooklib read_epub requires a file path, so we write to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
        
    try:
        book = epub.read_epub(tmp_path)
        chapters = []
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_body_content(), 'html.parser')
                text = soup.get_text(separator='\n')
                if text.strip():
                    chapters.append(text)
        return "\n".join(chapters)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse EPUB: {str(e)}")
    finally:
        os.remove(tmp_path)

def extract_text_from_fb2(file_bytes: bytes) -> str:
    try:
        soup = BeautifulSoup(file_bytes, 'html.parser')
        text_chunks = []
        for tag in soup.find_all(['p', 'v', 'subtitle', 'text-author']):
            text = tag.get_text().strip()
            if text:
                text_chunks.append(text)
        return "\n".join(text_chunks)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse FB2: {str(e)}")

def extract_text_from_mobi(file_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mobi") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
        
    extracted_dir = None
    try:
        extracted_dir, filepath = mobi.extract(tmp_path)
        with open(filepath, 'rb') as f:
            content = f.read()
        
        soup = BeautifulSoup(content, 'html.parser')
        text = soup.get_text(separator='\n')
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse MOBI: {str(e)}")
    finally:
        os.remove(tmp_path)
        if extracted_dir and os.path.exists(extracted_dir):
            import shutil
            shutil.rmtree(extracted_dir, ignore_errors=True)

def parse_uploaded_file(filename: str, file_bytes: bytes) -> str:
    """
    Parses the uploaded file based on its extension and returns the raw text.
    Supported extensions: .txt, .pdf, .docx, .epub, .fb2, .mobi
    """
    ext = filename.lower().split('.')[-1]
    
    if ext == 'txt':
        return extract_text_from_txt(file_bytes)
    elif ext == 'pdf':
        return extract_text_from_pdf(file_bytes)
    elif ext == 'docx':
        return extract_text_from_docx(file_bytes)
    elif ext == 'epub':
        return extract_text_from_epub(file_bytes)
    elif ext == 'fb2':
        return extract_text_from_fb2(file_bytes)
    elif ext == 'mobi':
        return extract_text_from_mobi(file_bytes)
    else:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format: .{ext}. Please upload .txt, .pdf, .docx, .epub, .fb2, or .mobi."
        )
