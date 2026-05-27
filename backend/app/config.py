from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AegisOps AI"
    environment: str = "dev"

    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    inferops_ai_url: str | None = None

    database_url: str = "postgresql://postgres:postgres@postgres:5432/aegisops"
    redis_url: str = "redis://redis:6379/0"
    prometheus_url: str = "http://prometheus:9090"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
