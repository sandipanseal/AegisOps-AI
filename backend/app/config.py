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
    redis_url: str = "redis://redis:6379/0"
    prometheus_url: str = "http://prometheus:9090"

    # Demo microservices used by the evidence agents. In Docker Compose these names
    # resolve through the internal Compose network.
    demo_service_urls: str = (
        "payment-service=http://payment-service:8100,"
        "checkout-service=http://checkout-service:8100,"
        "auth-service=http://auth-service:8100,"
        "recommendation-service=http://recommendation-service:8100"
    )

    class Config:
        env_file = ".env"


settings = Settings()


def demo_service_url_map() -> dict[str, str]:
    urls: dict[str, str] = {}
    for item in settings.demo_service_urls.split(","):
        if "=" not in item:
            continue
        name, url = item.split("=", 1)
        urls[name.strip()] = url.strip().rstrip("/")
    return urls
