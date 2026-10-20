
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.ingestion.pdf_processor import ingest_pdf

from pydantic import BaseModel, Field
from app.vectorstore.chroma_store import search_chunks

app = FastAPI(
    title="Personal Research Assistant API",
    description="An AI-powered research and literature analysis platform.",
    version="0.2.0",
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PAPERS_DIR = PROJECT_ROOT / "data" / "papers"
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

PAPERS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def root():
    return {
        "message": "Personal Research Assistant API is running!",
        "status": "healthy",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/documents/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    project_id: str = Form(...),
):
    """Upload a PDF and index its text in ChromaDB."""

    if not project_id.strip():
        raise HTTPException(
            status_code=400,
            detail="project_id cannot be empty.",
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    # Read at most 25 MB plus one byte to enforce the limit.
    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF exceeds the 25 MB upload limit.",
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    # Generate a unique storage name; don't trust the original path.
    document_id = uuid4().hex
    stored_path = PAPERS_DIR / f"{document_id}.pdf"
    stored_path.write_bytes(content)

    try:
        summary = ingest_pdf(
            pdf_path=stored_path,
            project_id=project_id.strip(),
            document_id=document_id,
        )

        # Return the original filename for display.
        summary["filename"] = Path(file.filename).name
        return {
            "message": "PDF uploaded and indexed successfully.",
            **summary,
        }

    except Exception as exc:
        stored_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=400,
            detail=f"Could not process this PDF: {exc}",
        ) from exc

    finally:
        await file.close()




class SearchRequest(BaseModel):
    project_id: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)
    document_id: str | None = None


@app.post("/search")
def search_documents(request: SearchRequest):
    """Retrieve relevant passages from an indexed research project."""

    results = search_chunks(
        query=request.query.strip(),
        project_id=request.project_id.strip(),
        top_k=request.top_k,
        document_id=request.document_id,
    )

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    passages = []

    for text, metadata, distance in zip(
        documents,
        metadatas,
        distances,
    ):
        passages.append({
            "text": text,
            "document_id": metadata.get("document_id"),
            "page_number": metadata.get("page_number"),
            "distance": round(float(distance), 4),
        })

    return {
        "query": request.query,
        "project_id": request.project_id,
        "result_count": len(passages),
        "results": passages,
    }
