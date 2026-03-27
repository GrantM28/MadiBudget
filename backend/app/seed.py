from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .models import AllowanceCategory


STARTER_CATEGORIES = [
    ("Groceries", 0),
    ("Clothes", 0),
    ("Gas", 0),
    ("Kids", 0),
    ("Household", 0),
    ("Misc", 0),
]


def seed_categories():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing_names = {
            name for name in db.scalars(select(AllowanceCategory.name)).all()
        }

        created = 0
        for name, monthly_budget in STARTER_CATEGORIES:
            if name in existing_names:
                continue

            db.add(AllowanceCategory(name=name, monthly_budget=monthly_budget))
            created += 1

        db.commit()
        return created
    finally:
        db.close()


def main():
    created = seed_categories()
    print(f"Seed complete. Added {created} starter categories.")


if __name__ == "__main__":
    main()
