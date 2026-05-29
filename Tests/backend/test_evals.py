"""RCA evaluation: single scoring and the full benchmark."""


def test_evaluate_rca_scoring(client):
    res = client.post(
        "/evals/rca",
        json={
            "predicted_root_cause": "database connection pool exhausted after deploy",
            "expected_root_cause": "connection pool exhaustion following the latest deployment",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert "rca_correctness_score" in body
    assert 0.0 <= body["rca_correctness_score"] <= 1.0
    assert isinstance(body["passed"], bool)


def test_run_benchmark_and_list(client):
    res = client.post("/evals/run-benchmark")
    assert res.status_code == 200
    benchmark = res.json()
    assert benchmark["total_cases"] > 0
    assert 0 <= benchmark["passed_cases"] <= benchmark["total_cases"]
    assert 0.0 <= benchmark["score"] <= 1.0

    listing = client.get("/evals")
    assert listing.status_code == 200
    assert len(listing.json()) >= 1
