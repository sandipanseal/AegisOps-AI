"""End-to-end incident lifecycle: create -> analyze -> approve runbook -> postmortem."""


def test_create_from_scenario(client):
    res = client.post("/incidents/from-scenario/payment_pool_regression")
    assert res.status_code == 200
    incident = res.json()
    assert incident["id"] > 0
    assert incident["service_name"] == "payment-service"
    assert incident["status"] == "open"


def test_create_from_unknown_scenario_404(client):
    res = client.post("/incidents/from-scenario/does_not_exist")
    assert res.status_code == 404


def test_create_custom_incident(client):
    payload = {
        "title": "Custom checkout latency",
        "description": "Checkout p95 latency elevated.",
        "service_name": "checkout-service",
        "severity": "high",
    }
    res = client.post("/incidents", json=payload)
    assert res.status_code == 200
    assert res.json()["service_name"] == "checkout-service"


def test_list_incidents(client, analyzed_incident):
    res = client.get("/incidents")
    assert res.status_code == 200
    incidents = res.json()
    assert any(i["id"] == analyzed_incident["id"] for i in incidents)


def test_analyze_produces_rca_evidence_and_traces(client, analyzed_incident):
    detail = client.get(f"/incidents/{analyzed_incident['id']}").json()

    # incident moved past "open"
    assert detail["incident"]["status"] in ("investigating", "resolved")

    # RCA synthesized with a sane confidence score
    assert detail["rca"] is not None
    assert 0.0 < detail["rca"]["confidence_score"] <= 1.0
    assert detail["rca"]["suspected_root_cause"]
    assert detail["rca"]["recommended_actions"]
    assert detail["rca"]["risky_actions"]
    assert detail["rca"]["requires_human_approval"] is True

    # Evidence from the collector agents (log/metrics/k8s/deployment + rag)
    assert len(detail["evidence"]) >= 4
    sources = {e["source"] for e in detail["evidence"]}
    assert {"logs", "metrics", "kubernetes", "deployment_history"} <= sources

    # Agent traces: 4 collectors + RAG + RCA
    assert len(detail["agent_traces"]) >= 5
    assert any(t["agent_name"] == "RCAAgent" for t in detail["agent_traces"])


def test_analyze_missing_incident_404(client):
    res = client.post("/incidents/99999/analyze")
    assert res.status_code == 404


def test_approve_runbook_resolves_incident(client, analyzed_incident):
    res = client.post(
        "/runbooks/approve",
        json={
            "incident_id": analyzed_incident["id"],
            "runbook_name": "restart_service",
            "approved": True,
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "simulated_success"

    detail = client.get(f"/incidents/{analyzed_incident['id']}").json()
    assert detail["incident"]["status"] == "resolved"
    assert any(r["runbook_name"] == "restart_service" for r in detail["runbooks"])
    # default approver reflects the SRE on-call, not a placeholder
    assert detail["runbooks"][0]["approved_by"] == "sre-oncall"


def test_reject_runbook_does_not_resolve(client):
    incident = client.post("/incidents/from-scenario/auth_secret_rotation").json()
    client.post(f"/incidents/{incident['id']}/analyze")
    res = client.post(
        "/runbooks/approve",
        json={"incident_id": incident["id"], "runbook_name": "restart_service", "approved": False},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    detail = client.get(f"/incidents/{incident['id']}").json()
    assert detail["incident"]["status"] != "resolved"


def test_list_runbooks(client):
    res = client.get("/runbooks")
    assert res.status_code == 200
    names = {r["key"] for r in res.json()}
    assert "restart_service" in names


def test_generate_postmortem(client, analyzed_incident):
    res = client.post(f"/incidents/{analyzed_incident['id']}/postmortem")
    assert res.status_code == 200
    body = res.json()
    assert body["incident_id"] == analyzed_incident["id"]
    assert len(body["markdown"]) > 0

    detail = client.get(f"/incidents/{analyzed_incident['id']}").json()
    assert detail["postmortem"]
