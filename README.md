# MadiBudget

MadiBudget is a self-hosted household budgeting and cash-flow app designed for a family managing a strict Chapter 13 repayment plan. It is built to answer one practical question:

> How much can we safely spend right now without messing up bills, the Chapter 13 payment, and monthly allowance categories?

This version is intentionally focused on one household and one backend API as the source of truth. It now includes a simple household login, but it still avoids multi-household logic, bank integrations, and SaaS billing.

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
- Auth: JWT bearer token auth with hashed passwords
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

## Security and Login

- The API is protected with bearer-token authentication.
- Passwords are hashed with `bcrypt` through `passlib`.
- The first time you open the app, MadiBudget will ask you to create the first household login.
- After first-run setup, the UI switches to normal sign-in.
- Set `AUTH_SECRET_KEY` to a long random secret before exposing the app through your reverse proxy.

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
$env:AUTH_SECRET_KEY="change-this-to-a-long-random-secret"
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

Update at least:

- `AUTH_SECRET_KEY`
- `CORS_ORIGINS`
- optionally `VITE_API_URL` if your reverse proxy does not serve frontend and API from the same host

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

- `GET /auth/status`
- `POST /auth/setup`
- `POST /auth/login`
- `GET /auth/me`
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
- On the very first visit, create the first household login from the sign-in screen.
- You should seed categories before adding transactions, because transactions require a valid existing category.
- The frontend uses `VITE_API_URL` when provided. Otherwise it defaults to `:8000` on local/private-network hosts and same-origin on custom domains like `budget.gmadi.me`.
- LAN IP access like `http://192.168.x.x:3040` is allowed by default for self-hosted local-network use.
- If you deploy behind `https://budget.gmadi.me`, add that origin to `CORS_ORIGINS` if the browser is calling the API across origins.

## Likely Issues To Watch For

- If PostgreSQL is not running or `DATABASE_URL` is wrong, the backend will not start.
- If you open the frontend from another machine, make sure port `8000` is reachable from that device too.
- If CORS blocks requests during local development, update `CORS_ORIGINS`.
- If you use a custom hostname instead of `localhost` or a private-network IP, add it to `CORS_ORIGINS` or set `CORS_ALLOW_ORIGIN_REGEX`.
- If `AUTH_SECRET_KEY` is left at the default development value, your deployment is not secure enough for internet exposure.
