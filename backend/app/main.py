import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .db import Base, engine
from .routers import bills, categories, dashboard, incomes, plan, transactions


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3040,http://127.0.0.1:3040")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
    title="MadiBudget API",
    version="1.0.0",
    description="Backend API for the MadiBudget Chapter 13 household budgeting app.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    models  # Keeps model import explicit for table discovery.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok", "app": "MadiBudget"}


app.include_router(dashboard.router)
app.include_router(incomes.router)
app.include_router(bills.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(plan.router)
