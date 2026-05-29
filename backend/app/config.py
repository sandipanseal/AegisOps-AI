from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AegisOps AI"
    environment: str = "dev"

    # Optional: direct OpenAI usage. If empty, the app uses deterministic fallback RCA.
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    # Optional: point this to your live InferOps AI LLM gateway.
    # Example: https://your-inferops-url.com
    inferops_ai_url: str | None = None
    inferops_api_key: str | None = None
    inferops_timeout_seconds: float = 20.0

    database_url: str = "postgresql://postgres:postgres@postgres:5432/aegisops"
    prometheus_url: str = "http://prometheus:9090"
    loki_url: str = "http://loki:3100"

    # Optional notification webhooks. If unset, notification calls are simulated.
    slack_webhook_url: str | None = None
    pagerduty_events_url: str = "https://events.pagerduty.com/v2/enqueue"
    pagerduty_routing_key: str | None = None

    # Local Kubernetes / Kind adapter. In Docker this is disabled by default.
    # For Kind/local use, run backend locally or mount kubeconfig and set ENABLE_K8S_ADAPTER=true.
    enable_k8s_adapter: bool = False
    kubeconfig_path: str | None = None

    # Simple model pricing defaults used when InferOps does not return cost metadata.
    default_prompt_cost_per_1k: float = 0.00015
    default_completion_cost_per_1k: float = 0.00060

    # Registry of monitored services the evidence agents read signals from.
    # In Docker Compose these names resolve through the internal Compose network.
    service_registry: str = (
        "payment-service=http://payment-service:8100,"
        "checkout-service=http://checkout-service:8100,"
        "auth-service=http://auth-service:8100,"
        "recommendation-service=http://recommendation-service:8100"
    )

    class Config:
        env_file = ".env"
        # Ignore unknown env vars (e.g. a stale REDIS_URL from an older .env) instead of crashing.
        extra = "ignore"


settings = Settings()


def service_registry_map() -> dict[str, str]:
    urls: dict[str, str] = {}
    for item in settings.service_registry.split(","):
        if "=" not in item:
            continue
        name, url = item.split("=", 1)
        urls[name.strip()] = url.strip().rstrip("/")
    return urls
