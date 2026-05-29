import os
from fastapi import FastAPI
from prometheus_client import Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

SERVICE_NAME = os.getenv("SERVICE_NAME", "payment-service")
SCENARIO_KEY = os.getenv("SCENARIO_KEY", "payment_pool_regression")

REQUESTS = Counter("demo_service_requests_total", "Requests handled by demo service", ["service"])
ERRORS = Counter("demo_service_errors_total", "Synthetic errors emitted by demo service", ["service", "mode"])
LATENCY = Gauge("demo_service_p95_latency_ms", "Synthetic p95 latency", ["service"])
MEMORY = Gauge("demo_service_memory_pct", "Synthetic memory saturation", ["service"])
ERROR_RATE = Gauge("demo_service_error_rate_pct", "Synthetic error rate", ["service"])

app = FastAPI(title=f"{SERVICE_NAME} demo service")

STATE = {
    "mode": "healthy",
    "p95_latency_ms": 120,
    "error_rate_pct": 0.4,
    "cpu_pct": 22,
    "memory_pct": 34,
    "logs": [f"INFO {SERVICE_NAME} service started", f"INFO {SERVICE_NAME} health check OK"],
    "kubernetes": {"pods": [{"name": f"{SERVICE_NAME}-a", "status": "Running", "restarts": 0}, {"name": f"{SERVICE_NAME}-b", "status": "Running", "restarts": 0}]},
    "deployment": {"commit": "stable-001", "message": "Stable baseline deployment", "minutes_ago": 240},
}

FAILURE_PRESETS = {
    "payment-service": {
        "mode": "db_pool_regression",
        "p95_latency_ms": 2400,
        "error_rate_pct": 11.8,
        "cpu_pct": 62,
        "memory_pct": 71,
        "logs": [
            "ERROR payment-service database connection timeout after 30000ms",
            "WARN payment-service retry attempt 3 failed",
            "ERROR payment-service connection pool exhausted active=50 idle=0",
        ],
        "kubernetes": {"pods": [{"name": "payment-a", "status": "Running", "restarts": 4}, {"name": "payment-b", "status": "CrashLoopBackOff", "restarts": 9}]},
        "deployment": {"commit": "a1b2c3d", "message": "Tune DB pool timeout and max connection settings", "minutes_ago": 18},
    },
    "checkout-service": {
        "mode": "dependency_timeout",
        "p95_latency_ms": 1350,
        "error_rate_pct": 5.1,
        "cpu_pct": 57,
        "memory_pct": 64,
        "logs": ["WARN checkout-service inventory request timeout", "ERROR checkout-service retry budget exhausted", "WARN checkout-service queue depth high"],
        "kubernetes": {"pods": [{"name": "checkout-a", "status": "Running", "restarts": 0}, {"name": "checkout-b", "status": "Running", "restarts": 0}]},
        "deployment": {"commit": "l1m2n3o", "message": "No checkout deployment in last 24h", "minutes_ago": 1440},
    },
    "auth-service": {
        "mode": "secret_rotation_error",
        "p95_latency_ms": 890,
        "error_rate_pct": 18.6,
        "cpu_pct": 48,
        "memory_pct": 59,
        "logs": ["ERROR auth-service JWT signature validation failed", "ERROR auth-service missing K8S secret jwt-signing-key", "WARN auth-service falling back to stale config"],
        "kubernetes": {"pods": [{"name": "auth-a", "status": "Running", "restarts": 1}, {"name": "auth-b", "status": "Running", "restarts": 1}], "secret_age_minutes": 12},
        "deployment": {"commit": "d4e5f6g", "message": "Rotate JWT signing secret and update auth env var", "minutes_ago": 14},
    },
    "recommendation-service": {
        "mode": "memory_leak",
        "p95_latency_ms": 1700,
        "error_rate_pct": 7.4,
        "cpu_pct": 81,
        "memory_pct": 97,
        "logs": ["WARN recommendation-service embedding cache size exceeded 1.8GB", "ERROR recommendation-service OOMKilled", "INFO recommendation-service cache entries=1500000"],
        "kubernetes": {"pods": [{"name": "reco-a", "status": "OOMKilled", "restarts": 6}, {"name": "reco-b", "status": "Running", "restarts": 5}]},
        "deployment": {"commit": "h7i8j9k", "message": "Add embedding cache for recommendation lookup", "minutes_ago": 63},
    },
}


def _refresh_metrics() -> None:
    LATENCY.labels(service=SERVICE_NAME).set(STATE["p95_latency_ms"])
    MEMORY.labels(service=SERVICE_NAME).set(STATE["memory_pct"])
    ERROR_RATE.labels(service=SERVICE_NAME).set(STATE["error_rate_pct"])


@app.on_event("startup")
def startup() -> None:
    _refresh_metrics()


@app.get("/health")
def health():
    REQUESTS.labels(service=SERVICE_NAME).inc()
    status = "degraded" if STATE["mode"] != "healthy" else "healthy"
    return {"service": SERVICE_NAME, "status": status, "mode": STATE["mode"]}


@app.get("/signals")
def signals():
    REQUESTS.labels(service=SERVICE_NAME).inc()
    _refresh_metrics()
    return {
        "service": SERVICE_NAME,
        "mode": STATE["mode"],
        "metrics": {"p95_latency_ms": STATE["p95_latency_ms"], "error_rate_pct": STATE["error_rate_pct"], "cpu_pct": STATE["cpu_pct"], "memory_pct": STATE["memory_pct"]},
        "kubernetes": STATE["kubernetes"],
        "deployment": STATE["deployment"],
    }


@app.get("/logs")
def logs():
    REQUESTS.labels(service=SERVICE_NAME).inc()
    return {"service": SERVICE_NAME, "logs": STATE["logs"]}


@app.post("/simulate-failure")
def simulate_failure():
    preset = FAILURE_PRESETS.get(SERVICE_NAME)
    if preset:
        STATE.update(preset)
        ERRORS.labels(service=SERVICE_NAME, mode=STATE["mode"]).inc()
        _refresh_metrics()
    return {"service": SERVICE_NAME, "mode": STATE["mode"], "status": "failure_injected"}


@app.post("/reset")
def reset():
    STATE.update({
        "mode": "healthy",
        "p95_latency_ms": 120,
        "error_rate_pct": 0.4,
        "cpu_pct": 22,
        "memory_pct": 34,
        "logs": [f"INFO {SERVICE_NAME} service started", f"INFO {SERVICE_NAME} health check OK"],
        "kubernetes": {"pods": [{"name": f"{SERVICE_NAME}-a", "status": "Running", "restarts": 0}, {"name": f"{SERVICE_NAME}-b", "status": "Running", "restarts": 0}]},
        "deployment": {"commit": "stable-001", "message": "Stable baseline deployment", "minutes_ago": 240},
    })
    _refresh_metrics()
    return {"service": SERVICE_NAME, "mode": STATE["mode"], "status": "reset"}


@app.get("/metrics")
def metrics():
    _refresh_metrics()
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
