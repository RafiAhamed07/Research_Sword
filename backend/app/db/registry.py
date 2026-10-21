import json
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
REGISTRY_PATH = PROJECT_ROOT / "data" / "documents.json"

def _load_all() -> list[dict]:
    if not REGISTRY_PATH.exists():
        return []
    try:
        return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

def _save_all(records: list[dict]) -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")

def register_document(
    document_id: str,
    project_id: str,
    filename: str,
    total_pages: int,
    total_chunks: int,
) -> dict:
    records = [
        r for r in _load_all()
        if not (r["document_id"] == document_id and r["project_id"] == project_id)
    ]
    record = {
        "document_id": document_id,
        "project_id": project_id,
        "filename": filename,
        "total_pages": total_pages,
        "total_chunks": total_chunks,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    records.append(record)
    _save_all(records)
    return record

def list_documents(project_id: str) -> list[dict]:
    return [r for r in _load_all() if r["project_id"] == project_id]

def remove_document(project_id: str, document_id: str) -> bool:
    records = _load_all()
    filtered = [
        r for r in records
        if not (r["document_id"] == document_id and r["project_id"] == project_id)
    ]
    if len(filtered) == len(records):
        return False
    _save_all(filtered)
    return True