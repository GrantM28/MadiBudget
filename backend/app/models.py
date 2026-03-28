from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String
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


class AllowanceCategory(Base):
    __tablename__ = "allowance_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    monthly_budget = Column(Numeric(10, 2), nullable=False)

    transactions = relationship("Transaction", back_populates="category", cascade="all, delete")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    date = Column(Date, nullable=False)
    transaction_type = Column(String(20), nullable=False, default="expense", server_default="expense")
    category_id = Column(Integer, ForeignKey("allowance_categories.id"), nullable=False)

    category = relationship("AllowanceCategory", back_populates="transactions")
