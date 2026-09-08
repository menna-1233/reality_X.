from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analyze, incidents, reports, stats

app = FastAPI(
    title="RealityX API",
    description="Backend for RealityX — Turning Real-World Problems into AI-Powered Solutions.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the real frontend origin before production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(incidents.router)
app.include_router(stats.router)
app.include_router(analyze.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
