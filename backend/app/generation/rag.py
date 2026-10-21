import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from app.vectorstore.chroma_store import search_chunks
from langchain_openai import ChatOpenAI
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL")

if not api_key:
    raise ValueError("GEMINI_API_KEY not found. Check your backend/.env file.")

### Gemini
llm = ChatGoogleGenerativeAI(
    model=model_name,
    google_api_key=api_key,
    temperature=0.1,
    max_output_tokens=1024,
    thinking_level="low",  # Fastest reasoning tier for gemini-3.8-flash
    max_retries=2,
)

### OpenAI
# llm = ChatOpenAI(
#     model=model_name,
#     api_key=api_key,
#     temperature=0.1,
#     max_tokens=2048,
#     max_retries=2,
# )

def rag_simple(
    query: str,
    project_id: str,
    document_id: str | None = None,
    llm=llm,
    top_k: int = 5,
) -> dict:
    """Retrieve chunks from ChromaDB and generate a grounded, cited answer."""
    raw_results = search_chunks(
        query=query.strip(),
        project_id=project_id.strip(),
        top_k=top_k,
        document_id=document_id,
    )

    documents = raw_results.get("documents", [[]])[0]
    metadatas = raw_results.get("metadatas", [[]])[0]
    distances = raw_results.get("distances", [[]])[0]

    if not documents:
        return {
            "answer": "No relevant context found to answer the question.",
            "citations": [],
        }

    context_parts = []
    citations = []

    for idx, (text, meta, dist) in enumerate(zip(documents, metadatas, distances), start=1):
        source_tag = f"[Source {idx}]"
        page_num = meta.get("page_number")
        doc_id = meta.get("document_id")

        context_parts.append(
            f"{source_tag} (Document ID: {doc_id}, Page: {page_num}):\n{text}"
        )

        citations.append({
            "source_id": source_tag,
            "document_id": doc_id,
            "page_number": page_num,
            "distance": round(float(dist), 4),
            "passage": text,
        })

    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""Use the following context from research papers to answer the question concisely.
Cite your statements using the source tags provided (e.g., [Source 1], [Source 2]).
If the answer isn't contained in the context, state clearly that there is insufficient evidence in the provided sources. Do not make up information or citations.

Context:
{context}

Question: {query}

Answer:"""

    response = llm.invoke(prompt)

    # Extract plain text whether LangChain returns a string or content blocks
    raw_content = response.content
    if isinstance(raw_content, list):
        answer_text = "\n".join(
            block.get("text", "")
            for block in raw_content
            if isinstance(block, dict) and block.get("type") == "text"
        ).strip()
    else:
        answer_text = str(raw_content).strip()

    return {
        "query": query,
        "project_id": project_id,
        "document_id": document_id,
        "answer": answer_text,
        "citations": citations,
    }