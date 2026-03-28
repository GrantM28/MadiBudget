from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Frequency = Literal["weekly", "biweekly", "monthly"]
BillType = Literal["bill", "chapter13"]


class IncomeSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    amount: Decimal = Field(..., gt=0)
    frequency: Frequency
    active: bool = True


class IncomeSourceCreate(IncomeSourceBase):
    pass


class IncomeSourceUpdate(IncomeSourceBase):
    pass


class IncomeSourceRead(IncomeSourceBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    amount: Decimal = Field(..., gt=0)
    due_day: int = Field(..., ge=1, le=31)
    recurring: bool = True
    type: BillType


class BillCreate(BillBase):
    pass


class BillUpdate(BillBase):
    pass


class BillRead(BillBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class AllowanceCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    monthly_budget: Decimal = Field(..., ge=0)


class AllowanceCategoryCreate(AllowanceCategoryBase):
    pass


class AllowanceCategoryUpdate(AllowanceCategoryBase):
    pass


class AllowanceCategoryRead(AllowanceCategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class TransactionBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    date: date
    category_id: int


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(TransactionBase):
    pass


class TransactionRead(TransactionBase):
    id: int
    category_name: str

    model_config = ConfigDict(from_attributes=True)


class CategorySummary(BaseModel):
    category_id: int
    category_name: str
    budget: Decimal
    spent: Decimal
    remaining: Decimal


class DashboardResponse(BaseModel):
    month: str
    monthly_income: Decimal
    total_bills: Decimal
    chapter13_payment_total: Decimal
    regular_bills_total: Decimal
    total_allowances: Decimal
    total_spent_in_allowance_categories: Decimal
    safe_to_spend_after_budgeted_categories: Decimal
    remaining_per_category: list[CategorySummary]


class PlanResponse(BaseModel):
    month: str
    monthly_income: Decimal
    total_bills: Decimal
    total_allowances: Decimal
    total_spent_in_allowance_categories: Decimal
    buffer_after_bills: Decimal
    safe_to_spend_after_budgeted_categories: Decimal
    buffer_after_actual_spending: Decimal
    remaining_per_category: list[CategorySummary]
