from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    default_community_id: str
    notify_report_count_threshold: int = 3

    # "mock" (keyword heuristic) or "ollama" (real open-source model via
    # a local Ollama server). See app/ollama_ai.py.
    ai_backend: str = "mock"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5vl"
    ollama_timeout_seconds: float = 60.0


settings = Settings()
