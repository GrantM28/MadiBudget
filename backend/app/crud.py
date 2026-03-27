from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
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


def list_incomes(db: Session):
    return db.scalars(select(models.IncomeSource).order_by(models.IncomeSource.name.asc())).all()


def create_income(db: Session, income: schemas.IncomeSourceCreate):
    record = models.IncomeSource(**income.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_bills(db: Session):
    return db.scalars(select(models.Bill).order_by(models.Bill.due_day.asc(), models.Bill.name.asc())).all()


def create_bill(db: Session, bill: schemas.BillCreate):
    record = models.Bill(**bill.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


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


def list_transactions(db: Session, month: str | None = None):
    start, end, _ = _month_bounds(month)
    rows = db.execute(
        select(models.Transaction, models.AllowanceCategory.name)
        .join(models.AllowanceCategory, models.Transaction.category_id == models.AllowanceCategory.id)
        .where(models.Transaction.date >= start, models.Transaction.date <= end)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
    ).all()

    return [
        schemas.TransactionRead(
            id=transaction.id,
            description=transaction.description,
            amount=transaction.amount,
            date=transaction.date,
            category_id=transaction.category_id,
            category_name=category_name,
        )
        for transaction, category_name in rows
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
        category_id=record.category_id,
        category_name=category.name,
    )


def calculate_dashboard(db: Session, month: str | None = None):
    start, end, label = _month_bounds(month)

    incomes = db.scalars(
        select(models.IncomeSource).where(models.IncomeSource.active.is_(True))
    ).all()
    bills = db.scalars(select(models.Bill)).all()
    categories = list_categories(db)

    monthly_income = ZERO
    for income in incomes:
        amount = Decimal(income.amount)
        if income.frequency == "weekly":
            monthly_income += amount * Decimal("52") / Decimal("12")
        elif income.frequency == "biweekly":
            monthly_income += amount * Decimal("26") / Decimal("12")
        else:
            monthly_income += amount

    regular_bills_total = ZERO
    chapter13_payment_total = ZERO
    for bill in bills:
        amount = Decimal(bill.amount)
        if bill.type == "chapter13":
            chapter13_payment_total += amount
        else:
            regular_bills_total += amount

    spent_rows = db.execute(
        select(models.Transaction.category_id, func.coalesce(func.sum(models.Transaction.amount), 0))
        .where(models.Transaction.date >= start, models.Transaction.date <= end)
        .group_by(models.Transaction.category_id)
    ).all()
    spent_by_category = {
        category_id: _normalize_money(Decimal(total))
        for category_id, total in spent_rows
    }

    remaining_per_category: list[schemas.CategorySummary] = []
    total_allowances = ZERO
    total_spent = ZERO

    for category in categories:
        budget = _normalize_money(Decimal(category.monthly_budget))
        spent = spent_by_category.get(category.id, ZERO)
        remaining = _normalize_money(budget - spent)

        total_allowances += budget
        total_spent += spent

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
    monthly_income = _normalize_money(monthly_income)
    total_allowances = _normalize_money(total_allowances)
    total_spent = _normalize_money(total_spent)
    regular_bills_total = _normalize_money(regular_bills_total)
    chapter13_payment_total = _normalize_money(chapter13_payment_total)
    safe_to_spend = _normalize_money(monthly_income - total_bills - total_allowances)
    buffer_after_bills = _normalize_money(monthly_income - total_bills)
    buffer_after_actual_spending = _normalize_money(monthly_income - total_bills - total_spent)

    return {
        "month": label,
        "monthly_income": monthly_income,
        "total_bills": total_bills,
        "chapter13_payment_total": chapter13_payment_total,
        "regular_bills_total": regular_bills_total,
        "total_allowances": total_allowances,
        "total_spent_in_allowance_categories": total_spent,
        "safe_to_spend_after_budgeted_categories": safe_to_spend,
        "buffer_after_bills": buffer_after_bills,
        "buffer_after_actual_spending": buffer_after_actual_spending,
        "remaining_per_category": remaining_per_category,
    }
