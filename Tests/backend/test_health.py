"""Health, metrics, dashboard, and scenario catalog."""


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["version"] == "1.0.0"


def test_metrics_exposes_prometheus(client):
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "aegisops_incidents_created_total" in res.text


def test_dashboard_summary_shape(client):
    res = client.get("/dashboard/summary")
    assert res.status_code == 200
    body = res.json()
    for key in ("total_incidents", "open", "investigating", "resolved", "agent_traces"):
        assert key in body
        assert isinstance(body[key], int)


def test_scenarios_catalog(client):
    res = client.get("/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) >= 4
    keys = {s["key"] for s in scenarios}
    assert "payment_pool_regression" in keys
    for s in scenarios:
        assert {"key", "title", "service_name", "severity", "description"} <= set(s)
