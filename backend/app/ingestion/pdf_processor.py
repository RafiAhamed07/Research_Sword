
from pathlib import Path
import re
import hashlib

import pymupdf

from app.vectorstore.chroma_store import (
    add_chunk,
    delete_document_chunks,
)


def clean_text(text: str) -> str:
    """Normalize whitespace extracted from a PDF page."""
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()



def split_into_chunks(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 200,
) -> list[str]:
    """
    Split text using paragraph and sentence boundaries where possible.
    Long sentences are split at word boundaries.

    Sizes are measured in characters, not tokens.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive.")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size.")

    text = clean_text(text)
    if not text:
        return []

    # First separate paragraphs, then sentences.
    paragraphs = re.split(r"\n\s*\n", text)
    units = []

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        sentences = re.split(r"(?<=[.!?])\s+", paragraph)

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            # Split unusually long sentences at word boundaries.
            while len(sentence) > chunk_size:
                split_at = sentence.rfind(" ", 0, chunk_size)

                if split_at <= 0:
                    split_at = chunk_size

                units.append(sentence[:split_at].strip())
                sentence = sentence[split_at:].strip()

            if sentence:
                units.append(sentence)

    chunks = []
    current = []

    for unit in units:
        candidate = "\n".join(current + [unit])

        if current and len(candidate) > chunk_size:
            chunks.append("\n".join(current))

            # Retain recent context for the next chunk.
            overlap_units = []
            overlap_length = 0

            for previous in reversed(current):
                extra_length = len(previous) + (
                    1 if overlap_units else 0
                )

                if overlap_length + extra_length > overlap:
                    break

                overlap_units.insert(0, previous)
                overlap_length += extra_length

            current = overlap_units

        current.append(unit)

    if current:
        chunks.append("\n".join(current))

    return chunks



def ingest_pdf(
    pdf_path: str | Path,
    project_id: str,
    document_id: str | None = None,
) -> dict:
    """Extract a PDF, chunk each page, and index chunks in ChromaDB."""

    pdf_path = Path(pdf_path)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    if pdf_path.suffix.lower() != ".pdf":
        raise ValueError("The supplied file must be a PDF.")

    if document_id is None:
        # Stable ID based on the file's contents.
        file_hash = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
        document_id = file_hash[:16]

    # Remove previously indexed chunks before re-indexing.
    delete_document_chunks(
        project_id=project_id,
        document_id=document_id,
    )

    total_pages = 0
    total_chunks = 0

    with pymupdf.open(pdf_path) as pdf:
        total_pages = len(pdf)

        for page_index, page in enumerate(pdf):
            page_text = clean_text(page.get_text("text"))

            if not page_text:
                # Scanned pages may require OCR.
                continue

            chunks = split_into_chunks(page_text)

            for chunk_index, chunk in enumerate(chunks):
                chunk_id = (
                    f"{project_id}-{document_id}"
                    f"-page-{page_index + 1}"
                    f"-chunk-{chunk_index + 1}"
                )

                add_chunk(
                    chunk_id=chunk_id,
                    text=chunk,
                    project_id=project_id,
                    document_id=document_id,
                    page_number=page_index + 1,
                )

                total_chunks += 1

    return {
        "project_id": project_id,
        "document_id": document_id,
        "filename": pdf_path.name,
        "total_pages": total_pages,
        "total_chunks": total_chunks,
    }