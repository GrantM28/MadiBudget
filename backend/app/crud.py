import csv
import io
import os
import uuid
from calendar import monthrange
from datetime import date
from decimal import Decimal
from math import ceil, floor
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import auth, models, schemas


ZERO = Decimal("0.00")
RECEIPTS_DIR = Path(os.getenv("RECEIPTS_DIR", str(Path(__file__).resolve().parent.parent / "uploads")))


def _normalize_money(value: Decimal | None) -> Decimal:
    return (value or ZERO).quantize(Decimal("0.01"))


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


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
    end = date(year, month_number, monthrange(year, month_number)[1])
    return start, end, f"{year:04d}-{month_number:02d}"


def _month_label_from_date(value: date) -> str:
    return value.strftime("%Y-%m")


def _previous_month_label(label: str) -> str:
    year, month_number = [int(part) for part in label.split("-")]
    if month_number == 1:
        year -= 1
        month_number = 12
    else:
        month_number -= 1
    return f"{year:04d}-{month_number:02d}"


def _months_between_inclusive(start_label: str, end_label: str) -> int:
    start_year, start_month = [int(part) for part in start_label.split("-")]
    end_year, end_month = [int(part) for part in end_label.split("-")]
    return (end_year - start_year) * 12 + (end_month - start_month) + 1


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


def _get_or_create_cash_position(db: Session) -> models.CashPosition:
    record = db.scalar(select(models.CashPosition).order_by(models.CashPosition.id.asc()))
    if record:
        return record

    record = models.CashPosition(
        name="Checking",
        current_balance=ZERO,
        balance_as_of=date.today(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _list_active_merchant_rules(db: Session) -> list[models.MerchantRule]:
    rules = db.scalars(
        select(models.MerchantRule)
        .where(models.MerchantRule.active.is_(True))
        .order_by(models.MerchantRule.group_name.asc(), models.MerchantRule.pattern.asc())
    ).all()
    return sorted(rules, key=lambda item: (-len(item.pattern or ""), item.pattern.lower()))


def _resolve_merchant_group(description: str, rules: list[models.MerchantRule]) -> str | None:
    normalized = description.strip().lower()
    for rule in rules:
        pattern = rule.pattern.strip().lower()
        if not pattern:
            continue
        if rule.match_type == "exact" and normalized == pattern:
            return rule.group_name
        if rule.match_type == "starts_with" and normalized.startswith(pattern):
            return rule.group_name
        if rule.match_type == "contains" and pattern in normalized:
            return rule.group_name
    return None


def _ensure_receipts_dir() -> Path:
    RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
    return RECEIPTS_DIR


def _save_receipt(file_bytes: bytes, original_name: str, prefix: str) -> str:
    receipts_dir = _ensure_receipts_dir()
    extension = Path(original_name or "").suffix[:20]
    filename = f"{prefix}_{uuid.uuid4().hex}{extension}"
    destination = receipts_dir / filename
    destination.write_bytes(file_bytes)
    return str(destination)


def _delete_receipt(path_value: str | None):
    if not path_value:
        return
    path = Path(path_value)
    if path.exists():
        path.unlink()


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
        payment_note=payment.note if payment else None,
        payment_has_receipt=bool(payment and payment.receipt_path),
        payment_receipt_name=payment.receipt_name if payment else None,
    )


def _serialize_transaction_row(
    transaction: models.Transaction,
    category_name: str | None,
    fixed_expense_id: int | None,
    fixed_expense_name: str | None,
    payment_note: str | None,
    payment_receipt_path: str | None,
    payment_receipt_name: str | None,
    merchant_rules: list[models.MerchantRule],
) -> schemas.TransactionRead:
    is_fixed_expense = transaction.fixed_expense_payment_id is not None
    receipt_path = payment_receipt_path if is_fixed_expense else transaction.receipt_path
    receipt_name = payment_receipt_name if is_fixed_expense else transaction.receipt_name
    note = payment_note if is_fixed_expense else transaction.note

    return schemas.TransactionRead(
        id=transaction.id,
        description=transaction.description,
        amount=transaction.amount,
        date=transaction.date,
        transaction_type=transaction.transaction_type,
        category_id=transaction.category_id,
        category_name=category_name,
        merchant_group=_resolve_merchant_group(transaction.description, merchant_rules),
        note=note,
        has_receipt=bool(receipt_path),
        receipt_name=receipt_name,
        source_type="fixed_expense" if fixed_expense_id else "allowance",
        fixed_expense_id=fixed_expense_id,
        fixed_expense_name=fixed_expense_name,
        locked=is_fixed_expense,
    )


def _category_monthly_spend_up_to(db: Session, end: date) -> dict[int, dict[str, Decimal]]:
    rows = db.scalars(
        select(models.Transaction).where(
            models.Transaction.date <= end,
            models.Transaction.category_id.is_not(None),
        )
    ).all()

    totals: dict[int, dict[str, Decimal]] = {}
    for transaction in rows:
        category_id = int(transaction.category_id)
        month_label = _month_label_from_date(transaction.date)
        contribution = Decimal(transaction.amount)
        if transaction.transaction_type == "income":
            contribution *= Decimal("-1")
        category_totals = totals.setdefault(category_id, {})
        category_totals[month_label] = _normalize_money(
            category_totals.get(month_label, ZERO) + contribution
        )

    return totals


def _build_category_summaries(
    db: Session,
    categories: list[models.AllowanceCategory],
    month_label: str,
    end: date,
) -> tuple[list[schemas.CategorySummary], Decimal, Decimal, Decimal, Decimal, int]:
    monthly_spend_map = _category_monthly_spend_up_to(db, end)

    remaining_per_category: list[schemas.CategorySummary] = []
    total_allowances = ZERO
    total_spent = ZERO
    remaining_budget_to_reserve_total = ZERO
    over_budget_total = ZERO
    categories_over_budget_count = 0
    previous_month_label = _previous_month_label(month_label)

    for category in categories:
        monthly_budget = _normalize_money(Decimal(category.monthly_budget))
        total_allowances += monthly_budget
        category_spend_by_month = monthly_spend_map.get(category.id, {})
        current_spent = _normalize_money(category_spend_by_month.get(month_label, ZERO))
        total_spent += current_spent
        carryover_before = ZERO
        budget_available = monthly_budget

        if category.budget_mode in {"rollover", "sinking_fund"}:
            starting_balance = _normalize_money(Decimal(category.starting_balance or ZERO))
            prior_month_labels = [label for label in category_spend_by_month if label < month_label]
            first_label = min(prior_month_labels) if prior_month_labels else month_label
            prior_month_count = (
                _months_between_inclusive(first_label, previous_month_label)
                if first_label <= previous_month_label
                else 0
            )
            prior_spend_total = ZERO
            for label, amount in category_spend_by_month.items():
                if label < month_label:
                    prior_spend_total += _normalize_money(amount)
            carryover_before = _normalize_money(
                starting_balance + (monthly_budget * prior_month_count) - prior_spend_total
            )
            budget_available = _normalize_money(carryover_before + monthly_budget)

        remaining = _normalize_money(budget_available - current_spent)

        if remaining > ZERO:
            remaining_budget_to_reserve_total += remaining
        elif remaining < ZERO:
            over_budget_total += abs(remaining)
            categories_over_budget_count += 1

        remaining_per_category.append(
            schemas.CategorySummary(
                category_id=category.id,
                category_name=category.name,
                budget=budget_available,
                monthly_budget=monthly_budget,
                spent=current_spent,
                remaining=remaining,
                budget_mode=category.budget_mode,
                carryover_balance=carryover_before,
            )
        )

    return (
        remaining_per_category,
        _normalize_money(total_allowances),
        _normalize_money(total_spent),
        _normalize_money(remaining_budget_to_reserve_total),
        _normalize_money(over_budget_total),
        categories_over_budget_count,
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


def get_cash_position(db: Session):
    return _get_or_create_cash_position(db)


def update_cash_position(db: Session, payload: schemas.CashPositionUpdate):
    record = _get_or_create_cash_position(db)
    record.current_balance = payload.current_balance
    record.balance_as_of = payload.balance_as_of
    db.commit()
    db.refresh(record)
    return record


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
            select(models.Transaction).where(models.Transaction.fixed_expense_payment_id == payment.id)
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
        _delete_receipt(payment.receipt_path)
        linked_transaction = db.scalar(
            select(models.Transaction).where(models.Transaction.fixed_expense_payment_id == payment.id)
        )
        if linked_transaction:
            _delete_receipt(linked_transaction.receipt_path)
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
            note=_clean_optional_text(payload.note),
        )
        db.add(payment)
        db.flush()
    else:
        payment.paid_date = payload.paid_date
        payment.note = _clean_optional_text(payload.note)

    linked_transaction = db.scalar(
        select(models.Transaction).where(models.Transaction.fixed_expense_payment_id == payment.id)
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

    _delete_receipt(payment.receipt_path)
    linked_transaction = db.scalar(
        select(models.Transaction).where(models.Transaction.fixed_expense_payment_id == payment.id)
    )
    if linked_transaction:
        db.delete(linked_transaction)

    db.delete(payment)
    db.commit()


def get_bill_payment(db: Session, bill_id: int, month: str) -> models.FixedExpensePayment:
    _, _, label = _month_bounds(month)
    payment = db.scalar(
        select(models.FixedExpensePayment).where(
            models.FixedExpensePayment.bill_id == bill_id,
            models.FixedExpensePayment.month_label == label,
        )
    )
    if not payment:
        raise LookupError("No paid record exists for that fixed expense in this month.")
    return payment


def upload_bill_payment_receipt(
    db: Session,
    bill_id: int,
    month: str,
    file_bytes: bytes,
    original_name: str,
    content_type: str | None,
):
    payment = get_bill_payment(db, bill_id, month)
    _delete_receipt(payment.receipt_path)
    payment.receipt_path = _save_receipt(file_bytes, original_name, f"bill_{bill_id}")
    payment.receipt_name = original_name
    payment.receipt_content_type = content_type
    db.commit()
    db.refresh(payment)
    return payment


def clear_bill_payment_receipt(db: Session, bill_id: int, month: str):
    payment = get_bill_payment(db, bill_id, month)
    if not payment.receipt_path:
        raise LookupError("No receipt is attached to that fixed expense payment.")
    _delete_receipt(payment.receipt_path)
    payment.receipt_path = None
    payment.receipt_name = None
    payment.receipt_content_type = None
    db.commit()


def get_bill_payment_receipt(db: Session, bill_id: int, month: str) -> tuple[str, str, str | None]:
    payment = get_bill_payment(db, bill_id, month)
    if not payment.receipt_path:
        raise LookupError("No receipt is attached to that fixed expense payment.")
    return payment.receipt_path, payment.receipt_name or "receipt", payment.receipt_content_type


def list_categories(db: Session):
    return db.scalars(
        select(models.AllowanceCategory).order_by(models.AllowanceCategory.name.asc())
    ).all()


def create_category(db: Session, category: schemas.AllowanceCategoryCreate):
    normalized_name = category.name.strip()
    existing = db.scalar(
        select(models.AllowanceCategory).where(
            func.lower(models.AllowanceCategory.name) == normalized_name.lower()
        )
    )
    if existing:
        raise ValueError("A category with that name already exists.")

    record = models.AllowanceCategory(
        name=normalized_name,
        monthly_budget=category.monthly_budget,
        budget_mode=category.budget_mode,
        starting_balance=category.starting_balance,
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
    record.budget_mode = category.budget_mode
    record.starting_balance = category.starting_balance
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


def list_merchant_rules(db: Session):
    return db.scalars(
        select(models.MerchantRule).order_by(models.MerchantRule.group_name.asc(), models.MerchantRule.pattern.asc())
    ).all()


def create_merchant_rule(db: Session, payload: schemas.MerchantRuleCreate):
    normalized_pattern = payload.pattern.strip()
    existing = db.scalar(
        select(models.MerchantRule).where(
            func.lower(models.MerchantRule.pattern) == normalized_pattern.lower()
        )
    )
    if existing:
        raise ValueError("A merchant rule with that pattern already exists.")

    record = models.MerchantRule(
        pattern=normalized_pattern,
        group_name=payload.group_name.strip(),
        match_type=payload.match_type,
        active=payload.active,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_merchant_rule(db: Session, rule_id: int, payload: schemas.MerchantRuleUpdate):
    record = db.get(models.MerchantRule, rule_id)
    if not record:
        raise LookupError("Merchant rule not found.")

    normalized_pattern = payload.pattern.strip()
    existing = db.scalar(
        select(models.MerchantRule).where(
            func.lower(models.MerchantRule.pattern) == normalized_pattern.lower(),
            models.MerchantRule.id != rule_id,
        )
    )
    if existing:
        raise ValueError("A merchant rule with that pattern already exists.")

    record.pattern = normalized_pattern
    record.group_name = payload.group_name.strip()
    record.match_type = payload.match_type
    record.active = payload.active
    db.commit()
    db.refresh(record)
    return record


def delete_merchant_rule(db: Session, rule_id: int):
    record = db.get(models.MerchantRule, rule_id)
    if not record:
        raise LookupError("Merchant rule not found.")
    db.delete(record)
    db.commit()


def _transaction_rows_for_month(db: Session, month: str | None):
    start, end, _ = _month_bounds(month)
    return db.execute(
        select(
            models.Transaction,
            models.AllowanceCategory.name,
            models.Bill.id,
            models.Bill.name,
            models.FixedExpensePayment.note,
            models.FixedExpensePayment.receipt_path,
            models.FixedExpensePayment.receipt_name,
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


def list_transactions(
    db: Session,
    month: str | None = None,
    q: str | None = None,
    category_id: int | None = None,
    transaction_type: str | None = None,
    source_type: str | None = None,
    merchant_group: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
):
    merchant_rules = _list_active_merchant_rules(db)
    rows = _transaction_rows_for_month(db, month)
    serialized = [
        _serialize_transaction_row(
            transaction,
            category_name,
            fixed_expense_id,
            fixed_expense_name,
            payment_note,
            payment_receipt_path,
            payment_receipt_name,
            merchant_rules,
        )
        for (
            transaction,
            category_name,
            fixed_expense_id,
            fixed_expense_name,
            payment_note,
            payment_receipt_path,
            payment_receipt_name,
        ) in rows
    ]

    search = (q or "").strip().lower()
    min_amount_value = Decimal(min_amount) if min_amount is not None else None
    max_amount_value = Decimal(max_amount) if max_amount is not None else None

    filtered: list[schemas.TransactionRead] = []
    for item in serialized:
        if search:
            haystack = " ".join(
                part
                for part in [
                    item.description,
                    item.category_name or "",
                    item.fixed_expense_name or "",
                    item.note or "",
                    item.merchant_group or "",
                ]
                if part
            ).lower()
            if search not in haystack:
                continue
        if category_id is not None and item.category_id != category_id:
            continue
        if transaction_type and item.transaction_type != transaction_type:
            continue
        if source_type and item.source_type != source_type:
            continue
        if merchant_group and (item.merchant_group or "") != merchant_group:
            continue
        amount_value = Decimal(item.amount)
        if min_amount_value is not None and amount_value < min_amount_value:
            continue
        if max_amount_value is not None and amount_value > max_amount_value:
            continue
        filtered.append(item)

    return filtered


def create_transaction(db: Session, transaction: schemas.TransactionCreate):
    category = db.get(models.AllowanceCategory, transaction.category_id)
    if not category:
        raise ValueError("Transaction category_id must reference an existing allowance category.")

    payload = transaction.model_dump()
    payload["note"] = _clean_optional_text(payload.get("note"))
    record = models.Transaction(**payload)
    db.add(record)
    db.commit()
    db.refresh(record)

    merchant_group = _resolve_merchant_group(record.description, _list_active_merchant_rules(db))
    return schemas.TransactionRead(
        id=record.id,
        description=record.description,
        amount=record.amount,
        date=record.date,
        transaction_type=record.transaction_type,
        category_id=record.category_id,
        category_name=category.name,
        merchant_group=merchant_group,
        note=record.note,
        has_receipt=bool(record.receipt_path),
        receipt_name=record.receipt_name,
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

    payload = transaction.model_dump()
    payload["note"] = _clean_optional_text(payload.get("note"))
    for field, value in payload.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)

    merchant_group = _resolve_merchant_group(record.description, _list_active_merchant_rules(db))
    return schemas.TransactionRead(
        id=record.id,
        description=record.description,
        amount=record.amount,
        date=record.date,
        transaction_type=record.transaction_type,
        category_id=record.category_id,
        category_name=category.name,
        merchant_group=merchant_group,
        note=record.note,
        has_receipt=bool(record.receipt_path),
        receipt_name=record.receipt_name,
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

    _delete_receipt(record.receipt_path)
    db.delete(record)
    db.commit()


def upload_transaction_receipt(
    db: Session,
    transaction_id: int,
    file_bytes: bytes,
    original_name: str,
    content_type: str | None,
):
    record = db.get(models.Transaction, transaction_id)
    if not record:
        raise LookupError("Transaction not found.")
    if record.fixed_expense_payment_id is not None:
        raise ValueError("Fixed expense payment receipts are managed from Fixed Expenses.")

    _delete_receipt(record.receipt_path)
    record.receipt_path = _save_receipt(file_bytes, original_name, f"transaction_{transaction_id}")
    record.receipt_name = original_name
    record.receipt_content_type = content_type
    db.commit()
    db.refresh(record)
    return record


def clear_transaction_receipt(db: Session, transaction_id: int):
    record = db.get(models.Transaction, transaction_id)
    if not record:
        raise LookupError("Transaction not found.")
    if record.fixed_expense_payment_id is not None:
        raise ValueError("Fixed expense payment receipts are managed from Fixed Expenses.")
    if not record.receipt_path:
        raise LookupError("No receipt is attached to that transaction.")

    _delete_receipt(record.receipt_path)
    record.receipt_path = None
    record.receipt_name = None
    record.receipt_content_type = None
    db.commit()


def get_transaction_receipt(db: Session, transaction_id: int) -> tuple[str, str, str | None]:
    record = db.get(models.Transaction, transaction_id)
    if not record:
        raise LookupError("Transaction not found.")
    if record.fixed_expense_payment_id is not None:
        payment = db.get(models.FixedExpensePayment, record.fixed_expense_payment_id)
        if not payment or not payment.receipt_path:
            raise LookupError("No receipt is attached to that fixed expense payment.")
        return payment.receipt_path, payment.receipt_name or "receipt", payment.receipt_content_type
    if not record.receipt_path:
        raise LookupError("No receipt is attached to that transaction.")
    return record.receipt_path, record.receipt_name or "receipt", record.receipt_content_type


def _csv_text(rows: list[list[object]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerows(rows)
    return buffer.getvalue()


def export_transactions_csv(
    db: Session,
    month: str | None = None,
    q: str | None = None,
    category_id: int | None = None,
    transaction_type: str | None = None,
    source_type: str | None = None,
    merchant_group: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
) -> str:
    transactions = list_transactions(
        db,
        month=month,
        q=q,
        category_id=category_id,
        transaction_type=transaction_type,
        source_type=source_type,
        merchant_group=merchant_group,
        min_amount=min_amount,
        max_amount=max_amount,
    )
    rows = [[
        "Date",
        "Description",
        "Type",
        "Amount",
        "Category",
        "Merchant Group",
        "Source",
        "Note",
        "Receipt",
    ]]
    for item in transactions:
        rows.append([
            item.date,
            item.description,
            item.transaction_type,
            item.amount,
            item.category_name or item.fixed_expense_name or "",
            item.merchant_group or "",
            item.source_type,
            item.note or "",
            item.receipt_name or "",
        ])
    return _csv_text(rows)


def export_fixed_expenses_csv(db: Session, month: str | None = None) -> str:
    rows = [[
        "Fixed Expense",
        "Due Date",
        "Paid Date",
        "Status",
        "Amount",
        "Payment Note",
        "Receipt",
    ]]
    for bill in list_bills(db, month):
        rows.append([
            bill.name,
            bill.due_date_for_month or "",
            bill.paid_date or "",
            "Paid" if bill.is_paid_for_month else "Unpaid",
            bill.amount,
            bill.payment_note or "",
            bill.payment_receipt_name or "",
        ])
    return _csv_text(rows)


def export_category_summary_csv(db: Session, month: str | None = None) -> str:
    dashboard = calculate_dashboard(db, month)
    rows = [[
        "Category",
        "Mode",
        "Monthly Budget",
        "Available This Month",
        "Carryover In",
        "Spent",
        "Remaining",
    ]]
    for item in dashboard["remaining_per_category"]:
        rows.append([
            item.category_name,
            item.budget_mode,
            item.monthly_budget,
            item.budget,
            item.carryover_balance,
            item.spent,
            item.remaining,
        ])
    return _csv_text(rows)


def list_users(db: Session):
    users = db.scalars(select(models.User).order_by(models.User.username.asc())).all()
    return [auth.serialize_user(user) for user in users]


def create_user(db: Session, payload: schemas.UserCreate):
    username = payload.username.strip()
    existing = auth.get_user_by_username(db, username)
    if existing:
        raise ValueError("That username is already in use.")
    email = _clean_optional_text(payload.email)
    if email and auth.get_user_by_email(db, email):
        raise ValueError("That email is already in use.")

    user = models.User(
        display_name=payload.display_name.strip(),
        username=username,
        email=email,
        role=payload.role,
        password_hash=auth.hash_password(payload.password),
        is_active=True,
        session_version=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return auth.serialize_user(user)


def delete_user(db: Session, user_id: int, current_user_id: int):
    user = db.get(models.User, user_id)
    if not user:
        raise LookupError("User not found.")

    total_users = db.scalar(select(func.count(models.User.id))) or 0
    if total_users <= 1:
        raise ValueError("You cannot remove the last household user.")
    if user.id == current_user_id:
        raise ValueError("Use another login to remove this user.")

    db.delete(user)
    db.commit()


def update_user_self(db: Session, user_id: int, payload: schemas.UserUpdateSelf):
    user = db.get(models.User, user_id)
    if not user:
        raise LookupError("User not found.")

    normalized_username = payload.username.strip()
    existing_user = auth.get_user_by_username(db, normalized_username)
    if existing_user and existing_user.id != user_id:
        raise ValueError("That username is already in use.")

    email = _clean_optional_text(payload.email)
    if email:
        existing_email = auth.get_user_by_email(db, email)
        if existing_email and existing_email.id != user_id:
            raise ValueError("That email is already in use.")

    user.display_name = payload.display_name.strip()
    user.username = normalized_username
    user.email = email
    db.commit()
    db.refresh(user)
    return auth.serialize_user(user)


def update_user_admin(db: Session, user_id: int, payload: schemas.UserAdminUpdate, current_user_id: int):
    user = db.get(models.User, user_id)
    if not user:
        raise LookupError("User not found.")

    normalized_username = payload.username.strip()
    existing_user = auth.get_user_by_username(db, normalized_username)
    if existing_user and existing_user.id != user_id:
        raise ValueError("That username is already in use.")

    email = _clean_optional_text(payload.email)
    if email:
        existing_email = auth.get_user_by_email(db, email)
        if existing_email and existing_email.id != user_id:
            raise ValueError("That email is already in use.")

    if user.role == "owner" and (payload.role != "owner" or not payload.is_active):
        owner_count = db.scalar(
            select(func.count(models.User.id)).where(
                models.User.role == "owner",
                models.User.is_active.is_(True),
                models.User.id != user_id,
            )
        )
        if (owner_count or 0) < 1:
            raise ValueError("At least one active owner must remain.")

    if user.id == current_user_id and payload.role != "owner":
        raise ValueError("You cannot remove owner access from your own account.")
    if user.id == current_user_id and not payload.is_active:
        raise ValueError("You cannot disable your own account.")

    user.display_name = payload.display_name.strip()
    user.username = normalized_username
    user.email = email
    user.role = payload.role
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return auth.serialize_user(user)


def admin_reset_user_password(db: Session, user_id: int, new_password: str):
    user = db.get(models.User, user_id)
    if not user:
        raise LookupError("User not found.")

    user.password_hash = auth.hash_password(new_password)
    user.session_version = int(user.session_version or 0) + 1
    auth.revoke_all_user_sessions(db, user)
    db.refresh(user)
    return auth.serialize_user(user)


def upload_user_avatar(
    db: Session,
    user_id: int,
    file_bytes: bytes,
    original_name: str,
    content_type: str | None,
):
    user = db.get(models.User, user_id)
    if not user:
        raise LookupError("User not found.")

    _delete_receipt(user.avatar_path)
    user.avatar_path = _save_receipt(file_bytes, original_name, f"avatar_{user_id}")
    user.avatar_name = original_name
    user.avatar_content_type = content_type
    db.commit()
    db.refresh(user)
    return auth.serialize_user(user)


def delete_user_avatar(db: Session, user_id: int):
    user = db.get(models.User, user_id)
    if not user:
        raise LookupError("User not found.")
    if not user.avatar_path:
        raise LookupError("No avatar is attached to that user.")

    _delete_receipt(user.avatar_path)
    user.avatar_path = None
    user.avatar_name = None
    user.avatar_content_type = None
    db.commit()
    db.refresh(user)
    return auth.serialize_user(user)


def get_user_avatar(db: Session, user_id: int) -> tuple[str, str, str | None]:
    user = db.get(models.User, user_id)
    if not user:
        raise LookupError("User not found.")
    if not user.avatar_path:
        raise LookupError("No avatar is attached to that user.")
    return user.avatar_path, user.avatar_name or "avatar", user.avatar_content_type


def calculate_dashboard(db: Session, month: str | None = None):
    start, end, label = _month_bounds(month)
    cash_position = _get_or_create_cash_position(db)

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

    (
        remaining_per_category,
        total_allowances,
        total_spent,
        remaining_budget_to_reserve_total,
        over_budget_total,
        categories_over_budget_count,
    ) = _build_category_summaries(db, categories, label, end)

    total_bills = _normalize_money(regular_bills_total + chapter13_payment_total)
    recurring_monthly_income = _normalize_money(recurring_monthly_income)
    variable_income_total = _normalize_money(variable_income_total)
    monthly_income = _normalize_money(monthly_income)
    regular_bills_total = _normalize_money(regular_bills_total)
    chapter13_payment_total = _normalize_money(chapter13_payment_total)
    safe_to_spend = _normalize_money(monthly_income - total_bills - total_allowances)
    buffer_after_bills = _normalize_money(monthly_income - total_bills)
    buffer_after_actual_spending = _normalize_money(monthly_income - total_bills - total_spent)
    projected_available_to_spend_right_now = _normalize_money(
        monthly_income - total_bills - total_spent - remaining_budget_to_reserve_total
    )
    current_checking_balance = _normalize_money(Decimal(cash_position.current_balance))
    available_to_spend_right_now = _normalize_money(
        current_checking_balance + projected_available_to_spend_right_now
    )

    return {
        "month": label,
        "current_checking_balance": current_checking_balance,
        "balance_as_of": cash_position.balance_as_of,
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
        "projected_available_to_spend_right_now": projected_available_to_spend_right_now,
        "available_to_spend_right_now": available_to_spend_right_now,
        "remaining_per_category": remaining_per_category,
    }
