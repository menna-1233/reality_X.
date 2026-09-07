"""Admin-only auth guard for protected routes.

Citizens never authenticate — they hit `/reports` (POST) and the read
endpoints with no credentials at all. Admins sign in through Supabase Auth
(email/password) on the frontend and send the resulting access token as
`Authorization: Bearer <token>` on requests that need elevated access
(changing a report/incident status, etc).

This dependency verifies that token against Supabase and checks the
caller's `profiles.role` is `admin` before letting the request through.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import get_client

_bearer = HTTPBearer(
    auto_error=False,
    description="Supabase access token for an admin account.",
)


async def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Verify the bearer token belongs to a signed-in admin.

    Returns the admin's user id on success; raises 401/403 otherwise.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin credentials",
        )

    client = get_client()

    try:
        user_response = client.auth.get_user(credentials.credentials)
    except Exception as exc:  # noqa: BLE001 - any invalid/expired token lands here
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        ) from exc

    user = user_response.user if user_response else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    profile = (
        client.table("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .execute()
        .data
    )
    if not profile or profile.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins only",
        )

    return user.id
