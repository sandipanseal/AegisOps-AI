"""Integration endpoints degrade gracefully when external systems are absent."""

import pytest


def test_simulate_failure_502_when_service_unreachable(client):
    # No service registry configured in tests -> the gateway reports the service down.
    res = client.post("/services/payment-service/simulate-failure")
    assert res.status_code == 502


def test_reset_service_502_when_unreachable(client):
    res = client.post("/services/payment-service/reset")
    assert res.status_code == 502


def test_service_signals_502_when_unreachable(client):
    res = client.get("/services/payment-service/signals")
    assert res.status_code == 502


def test_loki_search_returns_empty_when_loki_down(client):
    res = client.get("/logs/search", params={"service_name": "payment-service", "minutes": 60})
    assert res.status_code == 200
    body = res.json()
    assert body["service_name"] == "payment-service"
    assert body["logs"] == []


def test_kubernetes_status_disabled_by_default(client):
    res = client.get("/kubernetes/payment-service/status")
    assert res.status_code == 200
    assert res.json()["status"] == "disabled"


def test_notifications_test_and_list(client):
    res = client.post("/notifications/test")
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) >= 1
    assert all(r["status"] == "simulated" for r in results)

    listing = client.get("/notifications")
    assert listing.status_code == 200
    assert isinstance(listing.json(), list)


def test_rag_reindex_and_search(client, analyzed_incident):
    reindex = client.post("/rag/reindex")
    assert reindex.status_code == 200
    assert reindex.json()["indexed_documents"] >= 1

    search = client.get("/rag/search", params={"query": "payment timeout restart runbook", "limit": 5})
    assert search.status_code == 200
    body = search.json()
    assert body["query"]
    assert isinstance(body["results"], list)


def test_model_usage_shape(client):
    res = client.get("/model-usage")
    assert res.status_code == 200
    body = res.json()
    assert "total_calls" in body
    assert "total_cost_usd" in body
    assert isinstance(body["calls"], list)


def test_openai_client_disabled_without_key():
    """Without OPENAI_API_KEY the direct-OpenAI fallback stays inert (no live calls)."""
    from app.services.openai_client import OpenAIClient

    client = OpenAIClient()
    assert client.enabled() is False
    assert client.synthesize_rca_with_metadata("any prompt") is None


def test_model_invocation_recorded_when_llm_returns_metadata(client, monkeypatch):
    """When the RCA agent's LLM path returns metadata (gateway or OpenAI fallback),
    analysis records a ModelInvocation so /model-usage reflects live model economics."""
    from app.main import incident_service

    fake = {
        "text": "Root cause: connection pool exhaustion after the latest deploy.",
        "provider": "openai",
        "model": "gpt-4.1-mini",
        "latency_ms": 123.4,
        "prompt_tokens": 200,
        "completion_tokens": 100,
        "total_tokens": 300,
        "cost_usd": 0.00009,
        "status": "success",
    }
    monkeypatch.setattr(
        incident_service.rca_agent.openai, "synthesize_rca_with_metadata", lambda prompt: fake
    )

    before = client.get("/model-usage").json()["total_calls"]
    incident = client.post("/incidents/from-scenario/payment_pool_regression").json()
    client.post(f"/incidents/{incident['id']}/analyze")

    usage = client.get("/model-usage").json()
    assert usage["total_calls"] == before + 1
    latest = usage["calls"][0]
    assert latest["provider"] == "openai"
    assert latest["total_tokens"] == 300
    assert latest["cost_usd"] == pytest.approx(0.00009)
