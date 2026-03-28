from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from .db import Base


class IncomeSource(Base):
    __tablename__ = "income_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    frequency = Column(String(20), nullable=False)
    payday_reference_date = Column(Date, nullable=True)
    active = Column(Boolean, nullable=False, default=True, server_default="true")


class VariableIncomeEntry(Base):
    __tablename__ = "variable_income_entries"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    date = Column(Date, nullable=False)


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

    transactions = relationship("Transaction", back_populates="category", cascade="all, delete")


class FixedExpensePayment(Base):
    __tablename__ = "fixed_expense_payments"
    __table_args__ = (
        UniqueConstraint("bill_id", "month_label", name="uq_fixed_expense_payment_month"),
    )

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    month_label = Column(String(7), nullable=False, index=True)
    paid_date = Column(Date, nullable=False)

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
    fixed_expense_payment_id = Column(
        Integer,
        ForeignKey("fixed_expense_payments.id"),
        nullable=True,
        unique=True,
    )

    category = relationship("AllowanceCategory", back_populates="transactions")
    fixed_expense_payment = relationship("FixedExpensePayment", back_populates="transaction")
