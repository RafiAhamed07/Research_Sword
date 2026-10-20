
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import (
    SentenceTransformerEmbeddingFunction,
)

# Store persistent vector data outside the source code.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
CHROMA_PATH = PROJECT_ROOT / "data" / "chroma"

CHROMA_PATH.mkdir(parents=True, exist_ok=True)

embedding_function = SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

client = chromadb.PersistentClient(
    path=str(CHROMA_PATH)
)

collection = client.get_or_create_collection(
    name="research_chunks",
    embedding_function=embedding_function,
    metadata={"hnsw:space": "cosine"},
)


def add_chunk(
    chunk_id: str,
    text: str,
    project_id: str,
    document_id: str,
    page_number: int,
) -> None:
    collection.upsert(
        ids=[chunk_id],
        documents=[text],
        metadatas=[{
            "project_id": project_id,
            "document_id": document_id,
            "page_number": page_number,
        }],
    )



def search_chunks(
    query: str,
    project_id: str,
    top_k: int = 5,
    document_id: str | None = None,
) -> dict:
    where_filter = {"project_id": project_id}

    if document_id:
        where_filter = {
            "$and": [
                {"project_id": project_id},
                {"document_id": document_id},
            ]
        }

    return collection.query(
        query_texts=[query],
        n_results=top_k,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )


def delete_document_chunks(
    project_id: str,
    document_id: str,
) -> None:
    """Delete all indexed chunks belonging to one document."""
    collection.delete(
        where={
            "$and": [
                {"project_id": project_id},
                {"document_id": document_id},
            ]
        }
    )
