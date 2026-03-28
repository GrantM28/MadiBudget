from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Frequency = Literal["weekly", "biweekly", "monthly"]
BillType = Literal["bill", "chapter13"]
TransactionDirection = Literal["expense", "income"]
TransactionSource = Literal["allowance", "fixed_expense"]


class IncomeSourceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    amount: Decimal = Field(..., gt=0)
    frequency: Frequency
    payday_reference_date: date | None = None
    active: bool = True


class IncomeSourceCreate(IncomeSourceBase):
    pass


class IncomeSourceUpdate(IncomeSourceBase):
    pass


class IncomeSourceRead(IncomeSourceBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class VariableIncomeBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    date: date


class VariableIncomeCreate(VariableIncomeBase):
    pass


class VariableIncomeUpdate(VariableIncomeBase):
    pass


class VariableIncomeRead(VariableIncomeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class CashPositionUpdate(BaseModel):
    current_balance: Decimal
    balance_as_of: date


class CashPositionRead(BaseModel):
    id: int
    name: str
    current_balance: Decimal
    balance_as_of: date | None = None

    model_config = ConfigDict(from_attributes=True)


class BillBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    amount: Decimal = Field(..., gt=0)
    due_day: int = Field(..., ge=1, le=31)
    recurring: bool = True
    type: BillType = "bill"


class BillCreate(BillBase):
    pass


class BillUpdate(BillBase):
    pass


class BillPaymentUpdate(BaseModel):
    month: str
    paid_date: date


class BillRead(BillBase):
    id: int
    due_date_for_month: date | None = None
    paid_date: date | None = None
    is_paid_for_month: bool = False

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


class TransactionCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    date: date
    transaction_type: TransactionDirection = "expense"
    category_id: int


class TransactionUpdate(TransactionCreate):
    pass


class TransactionRead(BaseModel):
    id: int
    description: str
    amount: Decimal
    date: date
    transaction_type: TransactionDirection
    category_id: int | None = None
    category_name: str | None = None
    source_type: TransactionSource = "allowance"
    fixed_expense_id: int | None = None
    fixed_expense_name: str | None = None
    locked: bool = False

    model_config = ConfigDict(from_attributes=True)


class CategorySummary(BaseModel):
    category_id: int
    category_name: str
    budget: Decimal
    spent: Decimal
    remaining: Decimal


class DashboardResponse(BaseModel):
    month: str
    current_checking_balance: Decimal
    balance_as_of: date | None = None
    recurring_monthly_income: Decimal
    variable_income_total: Decimal
    monthly_income: Decimal
    total_bills: Decimal
    chapter13_payment_total: Decimal
    regular_bills_total: Decimal
    total_allowances: Decimal
    total_spent_in_allowance_categories: Decimal
    remaining_budget_to_reserve_total: Decimal
    over_budget_total: Decimal
    categories_over_budget_count: int
    safe_to_spend_after_budgeted_categories: Decimal
    projected_available_to_spend_right_now: Decimal
    available_to_spend_right_now: Decimal
    remaining_per_category: list[CategorySummary]


class PlanResponse(BaseModel):
    month: str
    current_checking_balance: Decimal
    balance_as_of: date | None = None
    recurring_monthly_income: Decimal
    variable_income_total: Decimal
    monthly_income: Decimal
    total_bills: Decimal
    total_allowances: Decimal
    total_spent_in_allowance_categories: Decimal
    remaining_budget_to_reserve_total: Decimal
    over_budget_total: Decimal
    categories_over_budget_count: int
    buffer_after_bills: Decimal
    safe_to_spend_after_budgeted_categories: Decimal
    buffer_after_actual_spending: Decimal
    projected_available_to_spend_right_now: Decimal
    available_to_spend_right_now: Decimal
    remaining_per_category: list[CategorySummary]
