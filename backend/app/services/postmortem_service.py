from app.database import RCAReport, EvidenceRecord, RunbookExecution, TimelineEvent


class PostmortemService:
    def generate(self, db, incident) -> str:
        rca = db.query(RCAReport).filter(RCAReport.incident_id == incident.id).order_by(RCAReport.id.desc()).first()
        evidence = db.query(EvidenceRecord).filter(EvidenceRecord.incident_id == incident.id).all()
        runbooks = db.query(RunbookExecution).filter(RunbookExecution.incident_id == incident.id).all()
        timeline = db.query(TimelineEvent).filter(TimelineEvent.incident_id == incident.id).order_by(TimelineEvent.id.asc()).all()

        rca_text = rca.suspected_root_cause if rca else "RCA has not been generated yet."
        confidence = f"{rca.confidence_score:.2f}" if rca else "n/a"
        evidence_lines = "\n".join([f"- **{item.source}:** {item.summary}" for item in evidence]) or "- No evidence collected yet."
        timeline_lines = "\n".join([f"- {item.created_at.isoformat()} — {item.actor}: {item.message}" for item in timeline]) or "- No timeline events."
        runbook_lines = "\n".join([f"- {item.runbook_name}: {item.status}" for item in runbooks]) or "- No runbooks executed."

        return f"""# Postmortem: {incident.title}

## Incident Summary
- **Service:** {incident.service_name}
- **Severity:** {incident.severity}
- **Status:** {incident.status}
- **Scenario:** {incident.scenario_key}

## Root Cause
{rca_text}

## AI Confidence
{confidence}

## Evidence
{evidence_lines}

## Timeline
{timeline_lines}

## Actions Taken
{runbook_lines}

## Follow-up Actions
- Add regression test for this failure pattern.
- Add dashboard panel and alert for early detection.
- Review deployment approval rules for high-risk configuration changes.
"""
