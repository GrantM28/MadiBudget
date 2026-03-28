from calendar import monthrange
from datetime import date
from decimal import Decimal
from math import ceil, floor

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from . import models, schemas


ZERO = Decimal("0.00")


def _normalize_money(value: Decimal | None) -> Decimal:
    return (value or ZERO).quantize(Decimal("0.01"))


def _month_bounds(month: str | None) -> tuple[date, date, str]:
    try:
        if month:
            year_str, month_str = month.split("-")
            year = int(year_str)
            month_number = int(month_str)
        else:
            today = date.today()
            year = today.year
            month_number = today.month
    except (TypeError, ValueError) as error:
        raise ValueError("Month must use YYYY-MM format.") from error

    if month_number < 1 or month_number > 12:
        raise ValueError("Month must use YYYY-MM format.")

    start = date(year, month_number, 1)
    last_day = monthrange(year, month_number)[1]
    end = date(year, month_number, last_day)
    label = f"{year:04d}-{month_number:02d}"
    return start, end, label


def _due_date_for_month(due_day: int, month: str | None) -> date:
    start, _, _ = _month_bounds(month)
    due_day_for_month = min(due_day, monthrange(start.year, start.month)[1])
    return date(start.year, start.month, due_day_for_month)


def _average_monthly_income(amount: Decimal, frequency: str) -> Decimal:
    if frequency == "weekly":
        return amount * Decimal("52") / Decimal("12")
    if frequency == "biweekly":
        return amount * Decimal("26") / Decimal("12")
    return amount


def _paychecks_in_month(
    start: date,
    end: date,
    payday_reference_date: date | None,
    frequency: str,
) -> int | None:
    if not payday_reference_date:
        return None

    interval_days = {"weekly": 7, "biweekly": 14}.get(frequency)
    if not interval_days:
        return 1 if frequency == "monthly" else None

    first_index = ceil((start - payday_reference_date).days / interval_days)
    last_index = floor((end - payday_reference_date).days / interval_days)
    return max(0, last_index - first_index + 1)


def _income_source_monthly_amount(
    income: models.IncomeSource,
    start: date,
    end: date,
) -> Decimal:
    amount = Decimal(income.amount)
    paychecks = _paychecks_in_month(start, end, income.payday_reference_date, income.frequency)

    if paychecks is None:
        return _average_monthly_income(amount, income.frequency)

    if income.frequency in {"weekly", "biweekly"}:
        return amount * paychecks

    return amount


def _serialize_bill(
    bill: models.Bill,
    payment: models.FixedExpensePayment | None,
    month: str | None,
) -> schemas.BillRead:
    return schemas.BillRead(
        id=bill.id,
        name=bill.name,
        amount=bill.amount,
        due_day=bill.due_day,
        recurring=bill.recurring,
        type=bill.type,
        due_date_for_month=_due_date_for_month(bill.due_day, month),
        paid_date=payment.paid_date if payment else None,
        is_paid_for_month=payment is not None,
    )


def list_incomes(db: Session):
    return db.scalars(select(models.IncomeSource).order_by(models.IncomeSource.name.asc())).all()


def create_income(db: Session, income: schemas.IncomeSourceCreate):
    record = models.IncomeSource(**income.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_income(db: Session, income_id: int, income: schemas.IncomeSourceUpdate):
    record = db.get(models.IncomeSource, income_id)
    if not record:
        raise LookupError("Income source not found.")

    for field, value in income.model_dump().items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


def delete_income(db: Session, income_id: int):
    record = db.get(models.IncomeSource, income_id)
    if not record:
        raise LookupError("Income source not found.")

    db.delete(record)
    db.commit()


def list_variable_income_entries(db: Session, month: str | None = None):
    query = select(models.VariableIncomeEntry)

    if month:
        start, end, _ = _month_bounds(month)
        query = query.where(
            models.VariableIncomeEntry.date >= start,
            models.VariableIncomeEntry.date <= end,
        )

    return db.scalars(
        query.order_by(models.VariableIncomeEntry.date.desc(), models.VariableIncomeEntry.id.desc())
    ).all()


def create_variable_income_entry(db: Session, entry: schemas.VariableIncomeCreate):
    record = models.VariableIncomeEntry(**entry.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_variable_income_entry(
    db: Session,
    entry_id: int,
    entry: schemas.VariableIncomeUpdate,
):
    record = db.get(models.VariableIncomeEntry, entry_id)
    if not record:
        raise LookupError("Variable income entry not found.")

    for field, value in entry.model_dump().items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


def delete_variable_income_entry(db: Session, entry_id: int):
    record = db.get(models.VariableIncomeEntry, entry_id)
    if not record:
        raise LookupError("Variable income entry not found.")

    db.delete(record)
    db.commit()


def list_bills(db: Session, month: str | None = None):
    _, _, label = _month_bounds(month)
    bills = db.scalars(select(models.Bill).order_by(models.Bill.due_day.asc(), models.Bill.name.asc())).all()
    payments = db.scalars(
        select(models.FixedExpensePayment).where(models.FixedExpensePayment.month_label == label)
    ).all()
    payments_by_bill = {payment.bill_id: payment for payment in payments}

    return [_serialize_bill(bill, payments_by_bill.get(bill.id), label) for bill in bills]


def create_bill(db: Session, bill: schemas.BillCreate):
    record = models.Bill(**bill.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize_bill(record, None, None)


def update_bill(db: Session, bill_id: int, bill: schemas.BillUpdate):
    record = db.get(models.Bill, bill_id)
    if not record:
        raise LookupError("Fixed expense not found.")

    for field, value in bill.model_dump().items():
        setattr(record, field, value)

    payment_rows = db.scalars(
        select(models.FixedExpensePayment).where(models.FixedExpensePayment.bill_id == bill_id)
    ).all()
    for payment in payment_rows:
        transaction = db.scalar(
            select(models.Transaction).where(
                models.Transaction.fixed_expense_payment_id == payment.id
            )
        )
        if transaction:
            transaction.description = record.name
            transaction.amount = record.amount

    db.commit()
    db.refresh(record)
    return _serialize_bill(record, None, None)


def delete_bill(db: Session, bill_id: int):
    record = db.get(models.Bill, bill_id)
    if not record:
        raise LookupError("Fixed expense not found.")

    payment_rows = db.scalars(
        select(models.FixedExpensePayment).where(models.FixedExpensePayment.bill_id == bill_id)
    ).all()
    for payment in payment_rows:
        linked_transaction = db.scalar(
            select(models.Transaction).where(
                models.Transaction.fixed_expense_payment_id == payment.id
            )
        )
        if linked_transaction:
            db.delete(linked_transaction)
        db.delete(payment)

    db.delete(record)
    db.commit()


def set_bill_payment(db: Session, bill_id: int, payload: schemas.BillPaymentUpdate):
    bill = db.get(models.Bill, bill_id)
    if not bill:
        raise LookupError("Fixed expense not found.")

    _, _, label = _month_bounds(payload.month)
    payment = db.scalar(
        select(models.FixedExpensePayment).where(
            models.FixedExpensePayment.bill_id == bill_id,
            models.FixedExpensePayment.month_label == label,
        )
    )

    if not payment:
        payment = models.FixedExpensePayment(
            bill_id=bill_id,
            month_label=label,
            paid_date=payload.paid_date,
        )
        db.add(payment)
        db.flush()
    else:
        payment.paid_date = payload.paid_date

    linked_transaction = db.scalar(
        select(models.Transaction).where(
            models.Transaction.fixed_expense_payment_id == payment.id
        )
    )
    if not linked_transaction:
        linked_transaction = models.Transaction(
            description=bill.name,
            amount=bill.amount,
            date=payload.paid_date,
            transaction_type="expense",
            category_id=None,
            fixed_expense_payment_id=payment.id,
        )
        db.add(linked_transaction)
    else:
        linked_transaction.description = bill.name
        linked_transaction.amount = bill.amount
        linked_transaction.date = payload.paid_date
        linked_transaction.transaction_type = "expense"
        linked_transaction.category_id = None

    db.commit()
    db.refresh(bill)
    db.refresh(payment)
    return _serialize_bill(bill, payment, label)


def clear_bill_payment(db: Session, bill_id: int, month: str):
    _, _, label = _month_bounds(month)
    payment = db.scalar(
        select(models.FixedExpensePayment).where(
            models.FixedExpensePayment.bill_id == bill_id,
            models.FixedExpensePayment.month_label == label,
        )
    )
    if not payment:
        raise LookupError("No paid date is recorded for that fixed expense in this month.")

    linked_transaction = db.scalar(
        select(models.Transaction).where(
            models.Transaction.fixed_expense_payment_id == payment.id
        )
    )
    if linked_transaction:
        db.delete(linked_transaction)

    db.delete(payment)
    db.commit()


def list_categories(db: Session):
    return db.scalars(
        select(models.AllowanceCategory).order_by(models.AllowanceCategory.name.asc())
    ).all()


def create_category(db: Session, category: schemas.AllowanceCategoryCreate):
    existing = db.scalar(
        select(models.AllowanceCategory).where(
            func.lower(models.AllowanceCategory.name) == category.name.strip().lower()
        )
    )
    if existing:
        raise ValueError("A category with that name already exists.")

    record = models.AllowanceCategory(
        name=category.name.strip(),
        monthly_budget=category.monthly_budget,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_category(db: Session, category_id: int, category: schemas.AllowanceCategoryUpdate):
    record = db.get(models.AllowanceCategory, category_id)
    if not record:
        raise LookupError("Category not found.")

    normalized_name = category.name.strip()
    existing = db.scalar(
        select(models.AllowanceCategory).where(
            func.lower(models.AllowanceCategory.name) == normalized_name.lower(),
            models.AllowanceCategory.id != category_id,
        )
    )
    if existing:
        raise ValueError("A category with that name already exists.")

    record.name = normalized_name
    record.monthly_budget = category.monthly_budget
    db.commit()
    db.refresh(record)
    return record


def delete_category(db: Session, category_id: int):
    record = db.get(models.AllowanceCategory, category_id)
    if not record:
        raise LookupError("Category not found.")

    linked_transactions = db.scalar(
        select(func.count(models.Transaction.id)).where(models.Transaction.category_id == category_id)
    )
    if linked_transactions:
        raise ValueError(
            "You cannot delete a category that still has transactions. Reassign or delete those transactions first."
        )

    db.delete(record)
    db.commit()


def list_transactions(db: Session, month: str | None = None):
    start, end, _ = _month_bounds(month)
    rows = db.execute(
        select(
            models.Transaction,
            models.AllowanceCategory.name,
            models.Bill.id,
            models.Bill.name,
        )
        .outerjoin(models.AllowanceCategory, models.Transaction.category_id == models.AllowanceCategory.id)
        .outerjoin(
            models.FixedExpensePayment,
            models.Transaction.fixed_expense_payment_id == models.FixedExpensePayment.id,
        )
        .outerjoin(models.Bill, models.FixedExpensePayment.bill_id == models.Bill.id)
        .where(models.Transaction.date >= start, models.Transaction.date <= end)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    ).all()

    return [
        schemas.TransactionRead(
            id=transaction.id,
            description=transaction.description,
            amount=transaction.amount,
            date=transaction.date,
            transaction_type=transaction.transaction_type,
            category_id=transaction.category_id,
            category_name=category_name,
            source_type="fixed_expense" if fixed_expense_id else "allowance",
            fixed_expense_id=fixed_expense_id,
            fixed_expense_name=fixed_expense_name,
            locked=transaction.fixed_expense_payment_id is not None,
        )
        for transaction, category_name, fixed_expense_id, fixed_expense_name in rows
    ]


def create_transaction(db: Session, transaction: schemas.TransactionCreate):
    category = db.get(models.AllowanceCategory, transaction.category_id)
    if not category:
        raise ValueError("Transaction category_id must reference an existing allowance category.")

    record = models.Transaction(**transaction.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)

    return schemas.TransactionRead(
        id=record.id,
        description=record.description,
        amount=record.amount,
        date=record.date,
        transaction_type=record.transaction_type,
        category_id=record.category_id,
        category_name=category.name,
        source_type="allowance",
        fixed_expense_id=None,
        fixed_expense_name=None,
        locked=False,
    )


def update_transaction(db: Session, transaction_id: int, transaction: schemas.TransactionUpdate):
    record = db.get(models.Transaction, transaction_id)
    if not record:
        raise LookupError("Transaction not found.")
    if record.fixed_expense_payment_id is not None:
        raise ValueError("Fixed expense payments are updated from Fixed Expenses.")

    category = db.get(models.AllowanceCategory, transaction.category_id)
    if not category:
        raise ValueError("Transaction category_id must reference an existing allowance category.")

    for field, value in transaction.model_dump().items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)

    return schemas.TransactionRead(
        id=record.id,
        description=record.description,
        amount=record.amount,
        date=record.date,
        transaction_type=record.transaction_type,
        category_id=record.category_id,
        category_name=category.name,
        source_type="allowance",
        fixed_expense_id=None,
        fixed_expense_name=None,
        locked=False,
    )


def delete_transaction(db: Session, transaction_id: int):
    record = db.get(models.Transaction, transaction_id)
    if not record:
        raise LookupError("Transaction not found.")
    if record.fixed_expense_payment_id is not None:
        raise ValueError("Fixed expense payments are removed from Fixed Expenses.")

    db.delete(record)
    db.commit()


def calculate_dashboard(db: Session, month: str | None = None):
    start, end, label = _month_bounds(month)

    incomes = db.scalars(
        select(models.IncomeSource).where(models.IncomeSource.active.is_(True))
    ).all()
    variable_income_entries = db.scalars(
        select(models.VariableIncomeEntry).where(
            models.VariableIncomeEntry.date >= start,
            models.VariableIncomeEntry.date <= end,
        )
    ).all()
    bills = db.scalars(select(models.Bill)).all()
    categories = list_categories(db)

    recurring_monthly_income = ZERO
    for income in incomes:
        recurring_monthly_income += _income_source_monthly_amount(income, start, end)

    variable_income_total = ZERO
    for entry in variable_income_entries:
        variable_income_total += Decimal(entry.amount)

    monthly_income = recurring_monthly_income + variable_income_total

    regular_bills_total = ZERO
    chapter13_payment_total = ZERO
    for bill in bills:
        amount = Decimal(bill.amount)
        if bill.type == "chapter13":
            chapter13_payment_total += amount
        else:
            regular_bills_total += amount

    spent_rows = db.execute(
        select(
            models.Transaction.category_id,
            func.coalesce(
                func.sum(
                    case(
                        (models.Transaction.transaction_type == "income", -models.Transaction.amount),
                        else_=models.Transaction.amount,
                    )
                ),
                0,
            ),
        )
        .where(
            models.Transaction.date >= start,
            models.Transaction.date <= end,
            models.Transaction.category_id.is_not(None),
        )
        .group_by(models.Transaction.category_id)
    ).all()
    spent_by_category = {
        category_id: _normalize_money(Decimal(total))
        for category_id, total in spent_rows
    }

    remaining_per_category: list[schemas.CategorySummary] = []
    total_allowances = ZERO
    total_spent = ZERO
    remaining_budget_to_reserve_total = ZERO
    over_budget_total = ZERO
    categories_over_budget_count = 0

    for category in categories:
        budget = _normalize_money(Decimal(category.monthly_budget))
        spent = spent_by_category.get(category.id, ZERO)
        remaining = _normalize_money(budget - spent)

        total_allowances += budget
        total_spent += spent

        if remaining > ZERO:
            remaining_budget_to_reserve_total += remaining
        elif remaining < ZERO:
            over_budget_total += abs(remaining)
            categories_over_budget_count += 1

        remaining_per_category.append(
            schemas.CategorySummary(
                category_id=category.id,
                category_name=category.name,
                budget=budget,
                spent=spent,
                remaining=remaining,
            )
        )

    total_bills = _normalize_money(regular_bills_total + chapter13_payment_total)
    recurring_monthly_income = _normalize_money(recurring_monthly_income)
    variable_income_total = _normalize_money(variable_income_total)
    monthly_income = _normalize_money(monthly_income)
    total_allowances = _normalize_money(total_allowances)
    total_spent = _normalize_money(total_spent)
    remaining_budget_to_reserve_total = _normalize_money(remaining_budget_to_reserve_total)
    over_budget_total = _normalize_money(over_budget_total)
    regular_bills_total = _normalize_money(regular_bills_total)
    chapter13_payment_total = _normalize_money(chapter13_payment_total)
    safe_to_spend = _normalize_money(monthly_income - total_bills - total_allowances)
    buffer_after_bills = _normalize_money(monthly_income - total_bills)
    buffer_after_actual_spending = _normalize_money(monthly_income - total_bills - total_spent)
    available_to_spend_right_now = _normalize_money(
        monthly_income - total_bills - total_spent - remaining_budget_to_reserve_total
    )

    return {
        "month": label,
        "recurring_monthly_income": recurring_monthly_income,
        "variable_income_total": variable_income_total,
        "monthly_income": monthly_income,
        "total_bills": total_bills,
        "chapter13_payment_total": chapter13_payment_total,
        "regular_bills_total": regular_bills_total,
        "total_allowances": total_allowances,
        "total_spent_in_allowance_categories": total_spent,
        "remaining_budget_to_reserve_total": remaining_budget_to_reserve_total,
        "over_budget_total": over_budget_total,
        "categories_over_budget_count": categories_over_budget_count,
        "safe_to_spend_after_budgeted_categories": safe_to_spend,
        "buffer_after_bills": buffer_after_bills,
        "buffer_after_actual_spending": buffer_after_actual_spending,
        "available_to_spend_right_now": available_to_spend_right_now,
        "remaining_per_category": remaining_per_category,
    }
