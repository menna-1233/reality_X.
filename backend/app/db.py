from functools import lru_cache

from supabase import Client, create_client

from .settings import settings


@lru_cache
def get_client() -> Client:
    """Server-side Supabase client using the service role key.

    Using the service role key means requests here bypass Row Level Security,
    which is expected — this backend enforces its own access rules and acts
    as the trusted intermediary between the frontend and the database.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
