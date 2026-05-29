from __future__ import annotations

import json
import httpx
from sqlalchemy.orm import Session
from app.config import settings
from app.database import NotificationEvent
from app.metrics import NOTIFICATIONS_SENT, TOOL_FAILURES


class NotificationService:
    def notify_incident(self, db: Session, incident, message: str) -> list[dict]:
        results = []
        results.append(self._send_slack(db, getattr(incident, "id", None), message))
        if getattr(incident, "severity", "") in {"critical", "high"}:
            results.append(self._send_pagerduty(db, getattr(incident, "id", None), incident, message))
        return results

    def _record(self, db: Session, incident_id: int | None, channel: str, status: str, payload: dict, response: dict) -> None:
        db.add(NotificationEvent(incident_id=incident_id, channel=channel, status=status, payload=json.dumps(payload), response=json.dumps(response)))
        NOTIFICATIONS_SENT.labels(channel=channel, status=status).inc()

    def _send_slack(self, db: Session, incident_id: int | None, message: str) -> dict:
        payload = {"text": message}
        if not settings.slack_webhook_url:
            response = {"mode": "simulated", "reason": "SLACK_WEBHOOK_URL not configured"}
            self._record(db, incident_id, "slack", "simulated", payload, response)
            return {"channel": "slack", "status": "simulated", "response": response}
        try:
            with httpx.Client(timeout=5) as client:
                res = client.post(settings.slack_webhook_url, json=payload)
                res.raise_for_status()
            response = {"status_code": res.status_code, "text": res.text[:300]}
            self._record(db, incident_id, "slack", "sent", payload, response)
            return {"channel": "slack", "status": "sent", "response": response}
        except Exception as exc:
            TOOL_FAILURES.labels(tool="slack_notification").inc()
            response = {"error": str(exc)}
            self._record(db, incident_id, "slack", "failed", payload, response)
            return {"channel": "slack", "status": "failed", "response": response}

    def _send_pagerduty(self, db: Session, incident_id: int | None, incident, message: str) -> dict:
        payload = {
            "routing_key": settings.pagerduty_routing_key or "not-configured",
            "event_action": "trigger",
            "payload": {
                "summary": message,
                "source": "aegisops-ai",
                "severity": "critical" if incident.severity == "critical" else "error",
                "custom_details": {"incident_id": incident.id, "service": incident.service_name},
            },
        }
        if not settings.pagerduty_routing_key:
            response = {"mode": "simulated", "reason": "PAGERDUTY_ROUTING_KEY not configured"}
            self._record(db, incident_id, "pagerduty", "simulated", payload, response)
            return {"channel": "pagerduty", "status": "simulated", "response": response}
        try:
            with httpx.Client(timeout=5) as client:
                res = client.post(settings.pagerduty_events_url, json=payload)
                res.raise_for_status()
            response = res.json() if res.headers.get("content-type", "").startswith("application/json") else {"text": res.text[:300]}
            self._record(db, incident_id, "pagerduty", "sent", payload, response)
            return {"channel": "pagerduty", "status": "sent", "response": response}
        except Exception as exc:
            TOOL_FAILURES.labels(tool="pagerduty_notification").inc()
            response = {"error": str(exc)}
            self._record(db, incident_id, "pagerduty", "failed", payload, response)
            return {"channel": "pagerduty", "status": "failed", "response": response}
