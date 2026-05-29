from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AegisOps AI"
    environment: str = "dev"

    # Optional: direct OpenAI usage. If empty, the app uses deterministic fallback RCA.
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    # Optional: point this to your live InferOps AI LLM gateway.
    inferops_ai_url: str | None = None

    database_url: str = "postgresql://postgres:postgres@postgres:5432/aegisops"
    redis_url: str = "redis://redis:6379/0"
    prometheus_url: str = "http://prometheus:9090"

    class Config:
        env_file = ".env"


settings = Settings()
