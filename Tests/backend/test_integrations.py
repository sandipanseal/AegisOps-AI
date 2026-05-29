"""Integration endpoints degrade gracefully when external systems are absent."""


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
