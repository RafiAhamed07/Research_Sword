from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.db.registry import list_documents, register_document, remove_document
from app.generation.rag import rag_simple
from app.ingestion.pdf_processor import ingest_pdf
from app.vectorstore.chroma_store import delete_document_chunks, search_chunks

app = FastAPI(
    title="Personal Research Assistant API",
    description="An AI-powered research and literature analysis platform.",
    version="0.3.0",
)

# Allow Next.js frontend on localhost:3000 to call FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PAPERS_DIR = PROJECT_ROOT / "data" / "papers"
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

PAPERS_DIR.mkdir(parents=True, exist_ok=True)


class SearchRequest(BaseModel):
    project_id: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)
    document_id: str | None = None


class ChatRequest(BaseModel):
    project_id: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)
    document_id: str | None = None


@app.get("/")
def root():
    return {
        "message": "Personal Research Assistant API is running!",
        "status": "healthy",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/projects/{project_id}/documents")
def get_project_documents(project_id: str):
    """List all uploaded documents in a research project."""
    docs = list_documents(project_id.strip())
    return {
        "project_id": project_id,
        "count": len(docs),
        "documents": docs,
    }


@app.post("/documents/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    project_id: str = Form(...),
):
    """Upload a PDF, index its text in ChromaDB, and save metadata."""
    clean_project_id = project_id.strip()
    if not clean_project_id:
        raise HTTPException(status_code=400, detail="project_id cannot be empty.")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="PDF exceeds the 25 MB upload limit.")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    document_id = uuid4().hex
    stored_path = PAPERS_DIR / f"{document_id}.pdf"
    stored_path.write_bytes(content)

    try:
        summary = ingest_pdf(
            pdf_path=stored_path,
            project_id=clean_project_id,
            document_id=document_id,
        )
        original_name = Path(file.filename).name
        summary["filename"] = original_name

        register_document(
            document_id=document_id,
            project_id=clean_project_id,
            filename=original_name,
            total_pages=summary["total_pages"],
            total_chunks=summary["total_chunks"],
        )

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


@app.delete("/projects/{project_id}/documents/{document_id}")
def delete_document(project_id: str, document_id: str):
    """Delete a document's chunks from ChromaDB, remove its file, and update registry."""
    delete_document_chunks(project_id=project_id.strip(), document_id=document_id.strip())
    stored_path = PAPERS_DIR / f"{document_id.strip()}.pdf"
    stored_path.unlink(missing_ok=True)
    removed = remove_document(project_id=project_id.strip(), document_id=document_id.strip())
    return {
        "message": "Document deleted.",
        "project_id": project_id,
        "document_id": document_id,
        "removed_from_registry": removed,
    }


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

    passages = [
        {
            "text": text,
            "document_id": metadata.get("document_id"),
            "page_number": metadata.get("page_number"),
            "distance": round(float(distance), 4),
        }
        for text, metadata, distance in zip(documents, metadatas, distances)
    ]

    return {
        "query": request.query,
        "project_id": request.project_id,
        "result_count": len(passages),
        "results": passages,
    }


@app.post("/chat")
def chat_with_papers(request: ChatRequest):
    """Ask a research question and get a Gemini-generated answer with citations."""
    try:
        return rag_simple(
            query=request.query,
            project_id=request.project_id,
            document_id=request.document_id,
            top_k=request.top_k,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {exc}",
        ) from exc