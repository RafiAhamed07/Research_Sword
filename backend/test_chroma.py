
from app.vectorstore.chroma_store import (
    add_chunk,
    search_chunks,
)

PROJECT_ID = "test-project-001"

add_chunk(
    chunk_id="paper-001-page-3",
    text=(
        "Vision Transformers divide an image into patches "
        "and process patch embeddings using self-attention."
    ),
    project_id=PROJECT_ID,
    document_id="paper-001",
    page_number=3,
)

add_chunk(
    chunk_id="paper-002-page-7",
    text=(
        "Glacier segmentation identifies glacier boundaries "
        "from satellite imagery using pixel-level predictions."
    ),
    project_id=PROJECT_ID,
    document_id="paper-002",
    page_number=7,
)

results = search_chunks(
    query="How do Vision Transformers process images?",
    project_id=PROJECT_ID,
    top_k=2,
)

for text, metadata, distance in zip(
    results["documents"][0],
    results["metadatas"][0],
    results["distances"][0],
):
    print(f"\nPassage: {text}")
    print(f"Metadata: {metadata}")
    print(f"Cosine distance: {distance:.4f}")
