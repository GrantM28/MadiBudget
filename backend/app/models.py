from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .db import Base


class IncomeSource(Base):
    __tablename__ = "income_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    frequency = Column(String(20), nullable=False)
    payday_reference_date = Column(Date, nullable=True)
    active = Column(Boolean, nullable=False, default=True, server_default="true")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    session_version = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class VariableIncomeEntry(Base):
    __tablename__ = "variable_income_entries"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    date = Column(Date, nullable=False)


class CashPosition(Base):
    __tablename__ = "cash_positions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, default="Checking", server_default="Checking")
    current_balance = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    balance_as_of = Column(Date, nullable=True)


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    due_day = Column(Integer, nullable=False)
    recurring = Column(Boolean, nullable=False, default=True, server_default="true")
    type = Column(String(20), nullable=False)

    payments = relationship("FixedExpensePayment", back_populates="bill", cascade="all, delete-orphan")


class AllowanceCategory(Base):
    __tablename__ = "allowance_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    monthly_budget = Column(Numeric(10, 2), nullable=False)
    budget_mode = Column(String(30), nullable=False, default="monthly_reset", server_default="monthly_reset")
    starting_balance = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")

    transactions = relationship("Transaction", back_populates="category", cascade="all, delete")


class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id = Column(Integer, primary_key=True, index=True)
    pattern = Column(String(255), nullable=False, unique=True)
    group_name = Column(String(120), nullable=False, index=True)
    match_type = Column(String(30), nullable=False, default="contains", server_default="contains")
    active = Column(Boolean, nullable=False, default=True, server_default="true")


class FixedExpensePayment(Base):
    __tablename__ = "fixed_expense_payments"
    __table_args__ = (
        UniqueConstraint("bill_id", "month_label", name="uq_fixed_expense_payment_month"),
    )

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    month_label = Column(String(7), nullable=False, index=True)
    paid_date = Column(Date, nullable=False)
    note = Column(String(2000), nullable=True)
    receipt_path = Column(String(500), nullable=True)
    receipt_name = Column(String(255), nullable=True)
    receipt_content_type = Column(String(120), nullable=True)

    bill = relationship("Bill", back_populates="payments")
    transaction = relationship(
        "Transaction",
        back_populates="fixed_expense_payment",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    date = Column(Date, nullable=False)
    transaction_type = Column(String(20), nullable=False, default="expense", server_default="expense")
    category_id = Column(Integer, ForeignKey("allowance_categories.id"), nullable=True)
    note = Column(String(2000), nullable=True)
    receipt_path = Column(String(500), nullable=True)
    receipt_name = Column(String(255), nullable=True)
    receipt_content_type = Column(String(120), nullable=True)
    fixed_expense_payment_id = Column(
        Integer,
        ForeignKey("fixed_expense_payments.id"),
        nullable=True,
        unique=True,
    )

    category = relationship("AllowanceCategory", back_populates="transactions")
    fixed_expense_payment = relationship("FixedExpensePayment", back_populates="transaction")
