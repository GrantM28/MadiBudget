import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from . import models
from .db import Base, engine
from .routers import bills, categories, dashboard, incomes, plan, transactions


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3040,http://127.0.0.1:3040")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _cors_origin_regex() -> str:
    return os.getenv(
        "CORS_ALLOW_ORIGIN_REGEX",
        r"^https?://("
        r"localhost|"
        r"127\.0\.0\.1|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$",
    )


app = FastAPI(
    title="MadiBudget API",
    version="1.0.0",
    description="Backend API for the MadiBudget Chapter 13 household budgeting app.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _ensure_schema_updates():
    inspector = inspect(engine)

    if "transactions" in inspector.get_table_names():
        transaction_columns = {
            column["name"] for column in inspector.get_columns("transactions")
        }
        if "transaction_type" not in transaction_columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE transactions "
                        "ADD COLUMN transaction_type VARCHAR(20) NOT NULL DEFAULT 'expense'"
                    )
                )
        if "fixed_expense_payment_id" not in transaction_columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE transactions "
                        "ADD COLUMN fixed_expense_payment_id INTEGER"
                    )
                )

        category_column = next(
            (column for column in inspector.get_columns("transactions") if column["name"] == "category_id"),
            None,
        )
        if category_column and not category_column.get("nullable", True):
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE transactions "
                        "ALTER COLUMN category_id DROP NOT NULL"
                    )
                )

    if "income_sources" in inspector.get_table_names():
        income_columns = {
            column["name"] for column in inspector.get_columns("income_sources")
        }
        if "payday_reference_date" not in income_columns:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "ALTER TABLE income_sources "
                        "ADD COLUMN payday_reference_date DATE"
                    )
                )


@app.on_event("startup")
def on_startup():
    models  # Keeps model import explicit for table discovery.
    Base.metadata.create_all(bind=engine)
    _ensure_schema_updates()


@app.get("/health")
def health():
    return {"status": "ok", "app": "MadiBudget"}


app.include_router(dashboard.router)
app.include_router(incomes.router)
app.include_router(bills.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(plan.router)
