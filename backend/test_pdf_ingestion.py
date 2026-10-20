
from pathlib import Path

from app.ingestion.pdf_processor import ingest_pdf
from app.vectorstore.chroma_store import search_chunks

PROJECT_ID = "research-project-001"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = PROJECT_ROOT / "data" / "papers" / "sample_paper.pdf"

# 1. Extract, chunk, and index the PDF.
summary = ingest_pdf(
    pdf_path=PDF_PATH,
    project_id=PROJECT_ID,
)

print("\nIngestion summary:")
for key, value in summary.items():
    print(f"{key}: {value}")

# 2. Search the indexed paper.
query = "What is the main contribution of this research paper?"

results = search_chunks(
    query=query,
    project_id=PROJECT_ID,
    top_k=5,
)

print("\nRetrieved passages:")

documents = results["documents"][0]
metadatas = results["metadatas"][0]
distances = results["distances"][0]

for i, (text, metadata, distance) in enumerate(
    zip(documents, metadatas, distances),
    start=1,
):
    print(f"\n--- Result {i} ---")
    print(f"Page: {metadata['page_number']}")
    print(f"Document ID: {metadata['document_id']}")
    print(f"Distance: {distance:.4f}")
    print(f"Passage: {text}")
