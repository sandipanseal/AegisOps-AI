from __future__ import annotations

import json
import math
import re
from collections import Counter
from sqlalchemy.orm import Session
from app.database import Incident, RCAReport, RunbookExecution, EvidenceRecord, RagDocument
from app.metrics import RAG_QUERIES
from pathlib import Path

TOKEN_RE = re.compile(r"[a-zA-Z0-9_\-]+")


def _tokens(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text)]


def _score(query: str, doc: str) -> float:
    q = Counter(_tokens(query))
    d = Counter(_tokens(doc))
    if not q or not d:
        return 0.0
    dot = sum(q[k] * d.get(k, 0) for k in q)
    qn = math.sqrt(sum(v * v for v in q.values()))
    dn = math.sqrt(sum(v * v for v in d.values()))
    return dot / max(qn * dn, 1e-9)


class RagService:
    def reindex(self, db: Session) -> dict:
        db.query(RagDocument).delete()
        count = 0
        for incident in db.query(Incident).all():
            evidence = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident.id).all()
            rca = db.query(RCAReport).filter(RCAReport.incident_id == incident.id).order_by(RCAReport.id.desc()).first()
            runbooks = db.query(RunbookExecution).filter(RunbookExecution.incident_id == incident.id).all()
            content = [incident.title, incident.description, incident.service_name, incident.severity, incident.status]
            content += [f"{e.source}: {e.summary} {e.details}" for e in evidence]
            if rca:
                content.append(rca.suspected_root_cause)
                content.append(rca.recommended_actions)
                content.append(rca.risky_actions)
            content += [r.result for r in runbooks]
            db.add(RagDocument(source_type="incident", source_id=str(incident.id), title=f"Incident #{incident.id}: {incident.title}", content="\n".join(content)))
            count += 1
        runbook_dir = Path(__file__).resolve().parent.parent / "runbooks"
        for path in runbook_dir.glob("*.yaml"):
            db.add(RagDocument(source_type="runbook", source_id=path.stem, title=f"Runbook: {path.stem}", content=path.read_text()))
            count += 1
        db.commit()
        return {"indexed_documents": count}

    def search(self, db: Session, query: str, limit: int = 5) -> list[dict]:
        docs = db.query(RagDocument).all()
        if not docs:
            self.reindex(db)
            docs = db.query(RagDocument).all()
        rows = []
        for doc in docs:
            score = _score(query, doc.title + "\n" + doc.content)
            if score > 0:
                rows.append({"id": doc.id, "source_type": doc.source_type, "source_id": doc.source_id, "title": doc.title, "score": round(score, 4), "snippet": doc.content[:500]})
        rows.sort(key=lambda x: x["score"], reverse=True)
        RAG_QUERIES.labels(source="postgres_keyword_memory").inc()
        return rows[:limit]
