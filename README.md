# 🗡️ Research Sword — Personal Research Assistant

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![ChromaDB](https://img.shields.io/badge/Vector%20Store-ChromaDB-orange.svg?style=flat)](https://www.trychroma.com/)
[![uv](https://img.shields.io/badge/Python%20Tooling-uv-blueviolet.svg?style=flat)](https://github.com/astral-sh/uv)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20v4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

**Research Sword** is an AI-powered literature review and research assistant designed for academics, researchers, and engineers. It implements a local and cloud-flexible **Retrieval-Augmented Generation (RAG)** pipeline that enables users to upload PDF research papers, index content with semantic chunking and sentence embeddings, and conduct conversational question-answering with exact, verifiable source citations and page numbers.

Repository: [https://github.com/RafiAhamed07/Research_Sword](https://github.com/RafiAhamed07/Research_Sword)

---

## 📑 Table of Contents

- [Overview & Key Features](#-overview--key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Directory Structure](#-directory-structure)
- [Core Workflows & Processing Pipeline](#-core-workflows--processing-pipeline)
  - [1. PDF Ingestion & Semantic Chunking](#1-pdf-ingestion--semantic-chunking)
  - [2. Embedding & Vector Indexing](#2-embedding--vector-indexing)
  - [3. Retrieval & RAG Inference](#3-retrieval--rag-inference)
- [API Reference](#-api-reference)
- [Prerequisites](#-prerequisites)
- [How to Run the Project](#-how-to-run-the-project)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup & Run](#2-backend-setup--run)
  - [3. Frontend Setup & Run](#3-frontend-setup--run)
- [Configuring the LLM Provider](#-configuring-the-llm-provider)
- [Diagnostic & Testing Scripts](#-diagnostic--testing-scripts)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [License](#-license)

---

## 🌟 Overview & Key Features

- **Multi-Tenant Project Isolation:** Organize research papers into distinct `project_id` workspaces (e.g., `research-project-001`, `machine-learning`, etc.). Documents, vector spaces, and chat histories remain strictly partitioned.
- **Intelligent PDF Ingestion:** Extracts text from PDF pages using PyMuPDF (`fitz`), normalizes whitespace, and segments text into character-sized windows (1,200 chars with 200 char overlap) respecting sentence and paragraph boundaries.
- **Semantic Vector Store (ChromaDB):** Generates 384-dimensional dense vector embeddings using `sentence-transformers/all-MiniLM-L6-v2` with cosine distance space, persisted locally in `data/chroma`.
- **Targeted or Cross-Paper Retrieval:** Query either an entire project's corpus or focus questions specifically on an individual research paper.
- **Strictly Grounded Answers & Evidence Explorer:** Answers are forced to cite sources using badges (e.g., `[Source 1]`). Clicking any citation badge smoothly scrolls to and reveals the exact source passage, page number, document name, and cosine similarity distance.
- **Multi-Model LLM Support:** Flexible LangChain generation layer supporting local Ollama (`llama3.1:8b`, `mistral`), Google Gemini (`gemini-3.8-flash`), and OpenAI model (`gpt-4o-mini`).
- **Modern, Reactive UI:** Next.js 16 App Router interface built with Tailwind CSS v4, dark/light theme toggle, real-time query cancellation, debounced project switching, and auto-expanding input prompt.

---


---

## 💻 Technology Stack

### Backend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Python** | `>=3.12` | Core backend runtime |
| **FastAPI** | `>=0.151.0` | High-performance REST API framework |
| **Uvicorn** | `>=0.54.0` | ASGI web server (supports auto-reload) |
| **uv** | Astral | Blazing-fast Python package and virtualenv manager |
| **ChromaDB** | `>=1.5.9` | Embedded vector database with cosine metric |
| **Sentence Transformers** | `>=6.1.0` | Local embedding model (`all-MiniLM-L6-v2`) |
| **PyMuPDF (`fitz`)** | `>=2.0` | High-speed PDF text parsing and extraction |
| **LangChain** | - | Orchestration for Ollama, Google GenAI, & OpenAI |
| **Pydantic** | `>=2.16.0` | Request validation & settings schema management |

### Frontend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **Next.js** | `16.4.2` | App Router React Framework |
| **React** | `19.3.0` | Modern UI library with concurrent capabilities |
| **TypeScript** | `^5` | Strict static type safety |
| **Tailwind CSS** | `^4` | Utility-first CSS styling via `@tailwindcss/turbopack` |
| **Turbopack** | Built-in | Ultra-fast development bundler |
| **Geist Font** | Next Font | Typography from Vercel (`geistSans`, `geistMono`) |

---

## 📁 Directory Structure

```text
personal-research-assistant/
├── backend/
│   ├── .env.example     
│   ├── .env           
│   ├── pyproject.toml            # uv project specification and dependencies
│   ├── uv.lock                   # Deterministic dependency lockfile
│   ├── requirements.txt          # Exported pip requirements
│   ├── diagnose_retrieval.py     # Script to evaluate semantic query quality
│   ├── inspect_nlp.py            # PDF text and ChromaDB chunk inspection
│   ├── reindex_nlp.py            # Re-indexing utility for specific documents
│   ├── test_chroma.py            # Direct ChromaDB vector store unit test
│   ├── test_pdf_ingestion.py     # End-to-end PDF ingestion and retrieval test
│   └── app/
│       ├── __init__.py
│       ├── main.py               # FastAPI entry point, routes, and CORS setup
│       ├── db/
│       │   ├── __init__.py
│       │   └── registry.py       # JSON metadata persistence (documents.json)
│       ├── generation/
│       │   └── rag.py            # Retrieval logic, prompt synthesis, LLM invocation
│       ├── ingestion/
│       │   ├── __init__.py
│       │   └── pdf_processor.py  # Text cleaning, boundary chunking, page indexing
│       └── vectorstore/
│           ├── __init__.py
│           └── chroma_store.py   # ChromaDB client, embeddings, chunk queries/deletions
├── data/
│   ├── chroma/                   # Persistent ChromaDB vector database index files
│   ├── documents.json            # Document metadata registry (ID, pages, chunks, date)
│   └── papers/                   # Stored PDF research papers (<document_id>.pdf)
├── frontend/
│   ├── package.json              # Next.js scripts and npm dependencies
│   ├── package-lock.json         # npm dependency tree lock
│   ├── tsconfig.json             # TypeScript compiler settings
│   ├── next.config.ts            # Next.js & Turbopack configuration
│   ├── eslint.config.mjs         # ESLint configuration
│   └── src/
│       └── app/
│           ├── favicon.ico
│           ├── globals.css       # Tailwind CSS v4 directives & root theme variables
│           ├── layout.tsx        # Root HTML layout with Geist font definition
│           └── page.tsx          # Full single-page research workspace UI
└── README.md                     # Project documentation
```

---

## ⚙️ Core Workflows & Processing Pipeline

### 1. PDF Ingestion & Semantic Chunking
- When a user uploads a PDF via `POST /documents/upload`, the backend verifies file validity and size ($\le 25\text{ MB}$).
- A unique 32-character hexadecimal UUID (`document_id`) is generated. The raw PDF is saved to `data/papers/{document_id}.pdf`.
- `app/ingestion/pdf_processor.py` opens the PDF using `pymupdf.open()` and processes page by page.
- Text is sanitized via `clean_text()` (null bytes removed, multiple spaces and excessive newlines collapsed).
- `split_into_chunks()` splits text on paragraph breaks (`\n\s*\n`) and sentence endings (`[.!?]`). Long sentences are divided at word boundaries. Chunks are assembled up to 1,200 characters with a 200-character trailing overlap to preserve semantic context across chunk seams.

### 2. Embedding & Vector Indexing
- Chunks receive deterministic IDs: `{project_id}-{document_id}-page-{page}-chunk-{chunk}`.
- Chunks are stored in ChromaDB's `research_chunks` collection using the `all-MiniLM-L6-v2` Sentence Transformer embedding function.
- ChromaDB associates metadata with each vector:
  ```json
  {
    "project_id": "research-project-001",
    "document_id": "79058a00fe7046db96fe60d6c836c775",
    "page_number": 1
  }
  ```
- Summary metadata is saved to `data/documents.json` by `app/db/registry.py`.

### 3. Retrieval & RAG Inference
- When a question is submitted via `POST /chat`:
  1. `app/vectorstore/chroma_store.py` executes a semantic similarity search using Chroma's cosine distance metric.
  2. If a specific `document_id` was chosen in the UI, Chroma filters by `{"$and": [{"project_id": ...}, {"document_id": ...}]}`. Otherwise, it searches across the whole project.
  3. The top $K$ results (default $k=5$) are formatted with explicit source tags: `[Source 1] (Document ID: ..., Page: ...):\n<passage>`.
  4. The synthesized prompt requires the model to:
     - Ground its answer solely on the provided context.
     - Cite claims using source tags (`[Source 1]`, `[Source 2]`).
     - Explicitly state if evidence is insufficient rather than hallucinating.
  5. The LLM produces the answer, which is parsed and returned along with citation metadata.

---

## 📡 API Reference

Base URL: `http://127.0.0.1:8000` (FastAPI Swagger UI available at `http://127.0.0.1:8000/docs`).

### Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Health and status check |
| `GET` | `/health` | Simple `{"status": "ok"}` ping |
| `GET` | `/projects/{project_id}/documents` | Retrieve all registered documents for a project |
| `POST` | `/documents/upload` | Upload a PDF (`multipart/form-data`) and index into ChromaDB |
| `DELETE` | `/projects/{project_id}/documents/{document_id}` | Delete paper from ChromaDB, disk, and registry |
| `POST` | `/search` | Semantic passage retrieval without LLM answer generation |
| `POST` | `/chat` | RAG endpoint: searches context and generates cited response |

#### Example: `POST /chat`
**Request Body:**
```json
{
  "project_id": "research-project-001",
  "query": "What are the limitations of the proposed approach?",
  "top_k": 5,
  "document_id": "79058a00fe7046db96fe60d6c836c775"
}
```

**Response Body:**
```json
{
  "query": "What are the limitations of the proposed approach?",
  "project_id": "research-project-001",
  "document_id": "79058a00fe7046db96fe60d6c836c775",
  "answer": "The authors highlight that the model relies heavily on large labeled datasets [Source 1] and exhibits decreased throughput during high-resolution processing [Source 2].",
  "citations": [
    {
      "source_id": "[Source 1]",
      "document_id": "79058a00fe7046db96fe60d6c836c775",
      "page_number": 14,
      "distance": 0.2841,
      "passage": "A major limitation of our method is its dependency on substantial labeled samples..."
    }
  ]
}
```

---

## 📋 Prerequisites

Before running the application, ensure you have:

1. **Python 3.12+** installed on your system.
2. **uv** (recommended Python package runner):
   - **macOS / Linux:** `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - **Windows (PowerShell):** `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
3. **Node.js (v18.x or v20.x+)** and **npm** installed.
4. **An LLM Provider** (choose one):
   - **Ollama (Default in code):** Install Ollama from [ollama.com](https://ollama.com) and pull the model:
     ```bash
     ollama run llama3.1:8b
     ```
   - **Google Gemini API:** Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
   - **Open Ai API:** Obtain an API key from [Open Ai](https://openai.com/api/).

---

## 🚀 How to Run the Project

### 1. Clone the Repository
```bash
git clone https://github.com/RafiAhamed07/Research_Sword.git
cd Research_Sword
```

---

### 2. Backend Setup & Run

1. Open a terminal and change into the `backend` directory:
   ```bash
   cd backend
   ```

2. Create your environment configuration file:
   - On Windows (PowerShell):
     ```powershell
     Copy-Item .env.example .env
     ```
   - On Linux/macOS:
     ```bash
     cp .env.example .env
     ```

3. Open `.env` and specify your credentials:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.8-flash
   OPENAI_API_KEY = "your_openai_api_key_here"
   OPENAI_MODEL = "gpt-4o-mini"
   ```

4. Install dependencies using `uv`:
   ```bash
   uv sync
   ```
   *(Or activate your virtualenv and run `pip install -r requirements.txt`)*

5. Start the FastAPI development server:
   ```bash
   uv run uvicorn app.main:app --reload
   ```

The backend server will start on **`http://127.0.0.1:8000`**. You can verify it by opening `http://127.0.0.1:8000/docs` in your browser.

---

### 3. Frontend Setup & Run

1. Open a **second terminal** and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. (Optional) If your backend is running on a port other than `8000`, configure `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
   ```

4. Start the Next.js development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 🤖 Configuring the LLM Provider

The inference engine in `backend/app/generation/rag.py` supports multiple LLM providers:

### Option A: Local Ollama (Active by default)
Make sure Ollama is running locally:
```bash
ollama serve
ollama pull llama3.1:8b
```
The client in `backend/app/generation/rag.py` connects to `http://127.0.0.1:11434`.

### Option B: Google Gemini Cloud
In `backend/app/generation/rag.py`, comment out the `ChatOllama` section and enable `ChatGoogleGenerativeAI`:
```python
# In backend/app/generation/rag.py:
llm = ChatGoogleGenerativeAI(
    model=model_name or "gemini-3.8-flash",
    google_api_key=api_key,
    temperature=0.1,
    max_output_tokens=1024,
    thinking_level="low",
    max_retries=2,
)
```
Ensure `GEMINI_API_KEY` is set in `backend/.env`.

### Option C: OpenAI
In `backend/app/generation/rag.py`, enable `ChatOpenAI`:
```python
# In backend/app/generation/rag.py:
llm = ChatOpenAI(
    model="gpt-4o-mini",
    api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0.1,
    max_tokens=2048,
)
```

---

## 🧪 Diagnostic & Testing Scripts

The backend includes standalone scripts for testing vector operations and diagnosing retrieval quality:

- **Test ChromaDB Vector Ingestion & Search:**
  ```bash
  cd backend
  uv run python test_chroma.py
  ```
- **Test PDF Ingestion and Search on Sample Paper:**
  ```bash
  cd backend
  uv run python test_pdf_ingestion.py
  ```
- **Inspect PDF Page Content vs ChromaDB Chunks:**
  ```bash
  cd backend
  uv run python inspect_nlp.py
  ```
- **Evaluate Query Semantic Distances:**
  ```bash
  cd backend
  uv run python diagnose_retrieval.py
  ```

---

## 🛠️ Troubleshooting & FAQ

1. **`ValueError: GEMINI_API_KEY not found. Check your backend/.env file.`**
   - Check that `backend/.env` exists and contains `GEMINI_API_KEY=...`. Note that `python-dotenv` loads from the current working directory, so start uvicorn from `backend/`.

2. **`Failed to fetch / Connection Refused in the Frontend`**
   - Ensure the FastAPI backend is running on `http://127.0.0.1:8000`.
   - Confirm that CORS in `backend/app/main.py` permits your frontend origin (`http://localhost:3000`).

3. **`Ollama connection error (Failed to connect to 127.0.0.1:11434)`**
   - Make sure the Ollama desktop service or daemon is active. Run `ollama list` in your shell to verify.
   - Alternatively, switch `backend/app/generation/rag.py` to use Gemini.

4. **PDF Upload Fails or Takes Long:**
   - The default file upload size limit is 25 MB on the backend and 50 MB on the frontend.
   - Pure image / scanned PDFs without embedded text layers require an OCR pre-processing step, as PyMuPDF extracts existing character streams.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
