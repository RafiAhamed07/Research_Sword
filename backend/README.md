# Research Sword — Backend Service

The backend is built with **FastAPI**, **ChromaDB**, **PyMuPDF**, and **LangChain**. It provides endpoints for PDF text extraction, boundary-aware semantic chunking, dense vector retrieval, and grounded RAG answer generation.

---

## 🚀 Quick Start

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `GEMINI_API_KEY` or Ollama endpoint is configured.

### 2. Install Dependencies
Using `uv`:
```bash
uv sync
```

### 3. Run Development Server
```bash
uv run uvicorn app.main:app --reload
```
The API will be available at:
- Service URL: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Interactive API Docs (Swagger): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Alternative Docs (ReDoc): [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 🧪 Testing & Diagnostics

- **ChromaDB sanity test:**
  ```bash
  uv run python test_chroma.py
  ```
- **PDF Ingestion & Query test:**
  ```bash
  uv run python test_pdf_ingestion.py
  ```
- **Semantic Distance Diagnostics:**
  ```bash
  uv run python diagnose_retrieval.py
  ```

For full system architecture and frontend documentation, refer to the [Root README](../README.md).
