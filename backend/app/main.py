import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from . import auth, models
from .db import Base, engine
from .routers import auth as auth_router
from .routers import bills, categories, dashboard, incomes, merchant_rules, plan, transactions, users


def _cors_origins() -> list[str]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3040,http://127.0.0.1:3040,https://budget.gmadi.me",
    )
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
    description="Backend API for the MadiBudget household budgeting app.",
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

    def ensure_column(table_name: str, column_name: str, definition_sql: str):
        if table_name not in inspector.get_table_names():
            return
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        if column_name not in existing_columns:
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {definition_sql}"))

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
        ensure_column("transactions", "note", "note VARCHAR(2000)")
        ensure_column("transactions", "receipt_path", "receipt_path VARCHAR(500)")
        ensure_column("transactions", "receipt_name", "receipt_name VARCHAR(255)")
        ensure_column("transactions", "receipt_content_type", "receipt_content_type VARCHAR(120)")

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

    ensure_column("users", "session_version", "session_version INTEGER NOT NULL DEFAULT 0")
    ensure_column("users", "display_name", "display_name VARCHAR(120) NOT NULL DEFAULT ''")
    ensure_column("users", "email", "email VARCHAR(255)")
    ensure_column("users", "role", "role VARCHAR(30) NOT NULL DEFAULT 'member'")
    ensure_column("users", "avatar_path", "avatar_path VARCHAR(500)")
    ensure_column("users", "avatar_name", "avatar_name VARCHAR(255)")
    ensure_column("users", "avatar_content_type", "avatar_content_type VARCHAR(120)")
    ensure_column("users", "last_login_at", "last_login_at TIMESTAMP WITH TIME ZONE")
    ensure_column(
        "allowance_categories",
        "budget_mode",
        "budget_mode VARCHAR(30) NOT NULL DEFAULT 'monthly_reset'",
    )
    ensure_column(
        "allowance_categories",
        "starting_balance",
        "starting_balance NUMERIC(10, 2) NOT NULL DEFAULT 0",
    )
    ensure_column("fixed_expense_payments", "note", "note VARCHAR(2000)")
    ensure_column("fixed_expense_payments", "receipt_path", "receipt_path VARCHAR(500)")
    ensure_column("fixed_expense_payments", "receipt_name", "receipt_name VARCHAR(255)")
    ensure_column(
        "fixed_expense_payments",
        "receipt_content_type",
        "receipt_content_type VARCHAR(120)",
    )


@app.on_event("startup")
def on_startup():
    models
    Base.metadata.create_all(bind=engine)
    _ensure_schema_updates()


@app.get("/health")
def health():
    return {"status": "ok", "app": "MadiBudget"}


app.include_router(auth_router.router)
app.include_router(dashboard.router, dependencies=[Depends(auth.require_current_user)])
app.include_router(incomes.router, dependencies=[Depends(auth.require_current_user)])
app.include_router(bills.router, dependencies=[Depends(auth.require_current_user)])
app.include_router(categories.router, dependencies=[Depends(auth.require_current_user)])
app.include_router(transactions.router, dependencies=[Depends(auth.require_current_user)])
app.include_router(merchant_rules.router, dependencies=[Depends(auth.require_current_user)])
app.include_router(users.router, dependencies=[Depends(auth.require_current_user)])
app.include_router(plan.router, dependencies=[Depends(auth.require_current_user)])
