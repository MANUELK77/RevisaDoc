from __future__ import annotations

import hashlib
import io
import re
from collections import Counter
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from spellchecker import SpellChecker

app = FastAPI(
    title="RevisaDoc API",
    version="0.1.0",
    description="Development API for reviewing PDF documents."
)

# Development-only CORS. Restrict allowed origins before deploying publicly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_FILES = 10


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "RevisaDoc API"}


def words(text: str) -> set[str]:
    return {
        word for word in re.findall(r"[^\W_]{4,}", text.lower(), flags=re.UNICODE)
        if word not in {
            "para", "como", "esta", "este", "entre", "sobre", "donde",
            "when", "which", "have", "with", "from", "that", "this"
        }
    }


def extract_pdf(data: bytes) -> tuple[str, int]:
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            try:
                result = reader.decrypt("")
                if result == 0:
                    raise ValueError("PDF is password protected")
            except Exception as exc:
                raise ValueError("PDF is password protected") from exc
        page_texts = [(page.extract_text() or "") for page in reader.pages]
        return "\n".join(page_texts).strip(), len(reader.pages)
    except Exception as exc:
        raise ValueError(str(exc)) from exc


def arithmetic_findings(text: str, filename: str) -> list[dict[str, Any]]:
    findings = []

    # Busca operaciones explícitas, por ejemplo: 120 + 80 = 250
    pattern = re.compile(
        r"(-?\d+(?:[.,]\d+)?)\s*([+\-*/×÷])\s*"
        r"(-?\d+(?:[.,]\d+)?)\s*=\s*(-?\d+(?:[.,]\d+)?)"
    )

    def number(value: str) -> float:
        return float(value.replace(",", "."))

    for match in pattern.finditer(text):
        a = number(match.group(1))
        op = match.group(2)
        b = number(match.group(3))
        shown = number(match.group(4))

        if op == "+":
            expected = a + b
        elif op == "-":
            expected = a - b
        elif op in ("*", "×"):
            expected = a * b
        elif op in ("/", "÷"):
            if b == 0:
                continue
            expected = a / b
        else:
            continue

        if abs(expected - shown) > 0.011:
            findings.append({
                "category": "math",
                "severity": "high",
                "file": filename,
                "page": None,
                "title": f"Posible error aritmético: {match.group(0)}",
                "suggestion": (
                    f"Comprobar operación: {a:g} {op} {b:g} = {expected:.2f}"
                ),
                "context": text[
                    max(0, match.start() - 60):
                    min(len(text), match.end() + 60)
                ],
            })

    return findings

def basic_spelling_findings(text: str, filename: str) -> list[dict[str, Any]]:
    dictionaries = {
        "tambien": "también",
        "informacion": "información",
        "documentacion": "documentación",
        "analisis": "análisis",
        "verificacion": "verificación",
        "teh": "the",
        "recieve": "receive",
        "seperate": "separate",
        "definately": "definitely",
        "provehedor": "proveedor",
        "recivir": "recibir",
        "diferensias": "diferencias",
        "tecnolojia": "tecnología",
        "administracion": "administración",
        "revision": "revisión",
        "publicacion": "publicación",
    }

    found = []

    # Mantener las correcciones conocidas y sus sugerencias.
    for wrong, correct in dictionaries.items():
        for match in re.finditer(
            rf"\b{re.escape(wrong)}\b", text, re.IGNORECASE
        ):
            found.append({
                "category": "spelling",
                "severity": "medium",
                "file": filename,
                "page": None,
                "title": f"Posible error ortográfico: {match.group(0)}",
                "suggestion": correct,
                "context": text[
                    max(0, match.start() - 50):
                    min(len(text), match.end() + 50)
                ],
            })

    # Revisión adicional con el corrector en español.
    spell = SpellChecker(language="es")
    words = re.findall(r"\b[a-záéíóúüñ]+\b", text.lower())

    known_errors = {word.lower() for word in dictionaries}

    for word in set(words):
        if len(word) < 4 or word in spell or word in known_errors:
            continue

        correction = spell.correction(word)

        if correction and correction != word:
            found.append({
                "category": "spelling",
                "severity": "low",
                "file": filename,
                "page": None,
                "title": f"Posible error ortográfico: {word}",
                "suggestion": f"Posible corrección: {correction}",
                "context": word,
            })

    return found


def data_findings(text: str, filename: str) -> list[dict[str, Any]]:
    from datetime import date
    found = []

    patterns = [
        (r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", "dmy"),
        (r"\b(\d{1,2})-(\d{1,2})-(\d{4})\b", "dmy"),
        (r"\b(\d{4})-(\d{2})-(\d{2})\b", "ymd"),
    ]

    for pattern, date_format in patterns:
        for match in re.finditer(pattern, text):
            try:
                if date_format == "ymd":
                    year, month, day = map(int, match.groups())
                else:
                    day, month, year = map(int, match.groups())

                date(year, month, day)

            except ValueError:
                found.append({
                    "category": "data",
                    "severity": "medium",
                    "file": filename,
                    "page": None,
                    "title": f"La fecha podría ser inválida: {match.group(0)}",
                    "suggestion": "Verifica la fecha original y el formato utilizado en el documento.",
                    "context": text[
                        max(0, match.start() - 50):
                        min(len(text), match.end() + 50)
                    ],
                })

    return found


@app.post("/api/analyze")
async def analyze(files: list[UploadFile] = File(...)) -> dict[str, Any]:
    if not files:
        raise HTTPException(status_code=400, detail="Select at least one PDF.")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES} files per request.")

    docs: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    seen_hashes: dict[str, str] = {}

    for upload in files:
        filename = upload.filename or "unnamed.pdf"
        if not filename.lower().endswith(".pdf"):
            findings.append({
                "category": "file",
                "severity": "high",
                "file": filename,
                "page": None,
                "title": "File does not have a .pdf extension",
                "suggestion": "Select a PDF document.",
                "context": "",
            })
            continue

        data = await upload.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            findings.append({
                "category": "file",
                "severity": "high",
                "file": filename,
                "page": None,
                "title": "File exceeds 20 MB",
                "suggestion": "Use a smaller PDF for this development version.",
                "context": "",
            })
            continue

        digest = hashlib.sha256(data).hexdigest()
        if digest in seen_hashes:
            findings.append({
                "category": "duplicate",
                "severity": "high",
                "file": filename,
                "page": None,
                "title": "Identical PDF detected",
                "suggestion": f"Same content as {seen_hashes[digest]}",
                "context": "",
            })
        else:
            seen_hashes[digest] = filename

        try:
            text, page_count = extract_pdf(data)
        except ValueError:
            findings.append({
                "category": "file",
                "severity": "high",
                "file": filename,
                "page": None,
                "title": "Could not read PDF",
                "suggestion": "The file may be damaged, encrypted, or unsupported.",
                "context": "",
            })
            continue

        doc = {"file": filename, "pages": page_count, "text": text, "sha256": digest}
        docs.append(doc)
        if not text:
            findings.append({
                "category": "ocr",
                "severity": "medium",
                "file": filename,
                "page": None,
                "title": "No selectable text found",
                "suggestion": "This PDF may be scanned and need OCR.",
                "context": "",
            })
            continue

        findings.extend(arithmetic_findings(text, filename))
        findings.extend(basic_spelling_findings(text, filename))
        findings.extend(data_findings(text, filename))

        seen_urls: set[str] = set()
        for url in re.findall(r"https?://[^\s<>\"')]+", text, re.IGNORECASE):
            if url in seen_urls:
                findings.append({
                    "category": "link",
                    "severity": "low",
                    "file": filename,
                    "page": None,
                    "title": "Enlace repetido en el documento",
                    "suggestion": "Comprueba si la repetición del enlace es intencional.",
                    "context": url,
                })
            seen_urls.add(url)

    # Document-to-document lexical similarity. This is not a plagiarism verdict.
    for index, left in enumerate(docs):
        for right in docs[index + 1:]:
            a, b = words(left["text"]), words(right["text"])
            union = a | b
            if not union:
                continue
            score = round(100 * len(a & b) / len(union))
            if score >= 20:
                findings.append({
                    "category": "similarity",
                    "severity": "medium" if score >= 60 else "low",
                    "file": left["file"],
                    "page": None,
                    "title": f"Text similarity with {right['file']}: {score}%",
                    "suggestion": "Review matching passages. Similarity alone does not prove plagiarism.",
                    "context": "Comparison is limited to PDFs uploaded in this request.",
                })

    return {
        "documents": [
            {"file": doc["file"], "pages": doc["pages"], "characters": len(doc["text"])}
            for doc in docs
        ],
        "findings": findings,
        "summary": {
            "documents": len(docs),
            "pages": sum(doc["pages"] for doc in docs),
            "findings": len(findings),
        },
        "notice": "Findings are preliminary indicators, not certified conclusions.",
    }
