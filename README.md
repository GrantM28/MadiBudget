# MadiBudget

MadiBudget is a self-hosted household budgeting and cash-flow app designed for a family managing a strict Chapter 13 repayment plan. It is built to answer one practical question:

> How much can we safely spend right now without messing up bills, the Chapter 13 payment, and monthly allowance categories?

This version is intentionally focused on one household and one backend API as the source of truth. There is no authentication, multi-household logic, bank integration, or SaaS billing in v1.

## What It Does

- Tracks income sources with pay frequency
- Tracks fixed monthly bills
- Stores the Chapter 13 payment as a bill with `type="chapter13"`
- Manages allowance categories with fixed monthly budgets
- Requires every transaction to use an existing allowance category
- Calculates monthly dashboard summaries
- Shows actual category spending and remaining balances
- Calculates a conservative safe-to-spend number based on budgeted category totals, not just actual spending

## Tech Stack

- Frontend: React + Vite
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL
- Deployment: Docker Compose

## Folder Structure

```text
MadiBudget/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── db.py
│       ├── models.py
│       ├── schemas.py
│       ├── crud.py
│       ├── seed.py
│       └── routers/
│           ├── __init__.py
│           ├── dashboard.py
│           ├── incomes.py
│           ├── bills.py
│           ├── categories.py
│           ├── transactions.py
│           └── plan.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── styles.css
        └── components/
            ├── Dashboard.jsx
            ├── IncomeList.jsx
            ├── BillList.jsx
            ├── CategoryList.jsx
            ├── TransactionForm.jsx
            └── TransactionList.jsx
```

## Core Budgeting Rules

- Every transaction must be assigned to an existing allowance category.
- Transactions cannot be uncategorized.
- The backend rejects any transaction where `category_id` does not exist.
- Safe-to-spend is based on monthly income minus all bills minus the full monthly allowance budgets.

Formula:

```text
safe_to_spend_after_budgeted_categories =
monthly income
- total bills
- total monthly allowance budgets
```

Monthly income conversion:

```text
weekly   = amount * 52 / 12
biweekly = amount * 26 / 12
monthly  = amount
```

## Run Locally Without Docker

### 1. Start PostgreSQL

You need a PostgreSQL database running locally. The app defaults to:

```text
Host: localhost
Port: 5433
Database: madibudget
User: madibudget
Password: madibudget
```

If your local database uses different settings, set `DATABASE_URL` before starting the backend.

### 2. Backend setup

From the project root:

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL="postgresql://madibudget:madibudget@localhost:5433/madibudget"
$env:CORS_ORIGINS="http://localhost:3040,http://127.0.0.1:3040"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Seed starter categories

In a second backend terminal:

```bash
cd backend
.venv\Scripts\Activate.ps1
$env:DATABASE_URL="postgresql://madibudget:madibudget@localhost:5433/madibudget"
python -m app.seed
```

Starter categories:

- Groceries
- Clothes
- Gas
- Kids
- Household
- Misc

### 4. Frontend setup

In a new terminal:

```bash
cd frontend
npm install
$env:VITE_API_URL="http://localhost:8000"
npm run dev -- --host 0.0.0.0 --port 3040
```

### Local URLs

- Frontend: [http://localhost:3040](http://localhost:3040)
- Backend API: [http://localhost:8000](http://localhost:8000)
- FastAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Run With Docker Compose

### 1. Copy env file

```bash
Copy-Item .env.example .env
```

### 2. Build and start

```bash
docker compose up --build -d
```

### 3. Seed starter categories

```bash
docker compose exec madibudget-backend python -m app.seed
```

### Docker URLs

- Frontend: [http://localhost:3040](http://localhost:3040)
- Backend API: [http://localhost:8000](http://localhost:8000)
- PostgreSQL externally: `localhost:5433`

## API Endpoints

- `GET /dashboard`
- `GET /incomes`
- `POST /incomes`
- `GET /bills`
- `POST /bills`
- `GET /categories`
- `POST /categories`
- `GET /transactions`
- `POST /transactions`
- `GET /plan`

Optional month filters:

- `GET /dashboard?month=YYYY-MM`
- `GET /transactions?month=YYYY-MM`
- `GET /plan?month=YYYY-MM`

## First-Run Notes

- The backend creates database tables automatically on startup.
- You should seed categories before adding transactions, because transactions require a valid existing category.
- The frontend uses either `VITE_API_URL` or the current browser hostname with port `8000`.

## Likely Issues To Watch For

- If PostgreSQL is not running or `DATABASE_URL` is wrong, the backend will not start.
- If you open the frontend from another machine, make sure port `8000` is reachable from that device too.
- If CORS blocks requests during local development, update `CORS_ORIGINS`.
- The frontend does not include auth yet, so keep the app on a trusted network.
