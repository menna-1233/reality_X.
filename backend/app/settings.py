from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    default_community_id: str
    notify_report_count_threshold: int = 3

    # "mock"  → keyword heuristic, no setup needed
    # "ollama" → local open-source model via Ollama (see app/ollama_ai.py)
    # "groq"  → free cloud inference via Groq API (see app/groq_ai.py)
    ai_backend: str = "mock"

    # Ollama settings (only used when ai_backend="ollama")
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5vl:3b"
    ollama_timeout_seconds: float = 60.0

    # Groq settings (only used when ai_backend="groq")
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Department email notifications (Gmail SMTP). See app/email_service.py.
    smtp_enabled: bool = False
    smtp_email: str = ""
    smtp_app_password: str = ""
    # Optional JSON override, e.g. {"pothole": "roads@city.gov"}
    department_emails: str = ""


settings = Settings()
