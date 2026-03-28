import { useEffect, useState } from "react";
import { api } from "./api";
import Dashboard from "./components/Dashboard";
import IncomeList from "./components/IncomeList";
import BillList from "./components/BillList";
import CategoryList from "./components/CategoryList";
import TransactionForm from "./components/TransactionForm";
import TransactionList from "./components/TransactionList";

function currentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default function App() {
  const [month, setMonth] = useState(currentMonthValue());
  const [dashboard, setDashboard] = useState(null);
  const [plan, setPlan] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        dashboardData,
        planData,
        incomesData,
        billsData,
        categoriesData,
        transactionsData,
      ] = await Promise.all([
        api.getDashboard(month),
        api.getPlan(month),
        api.getIncomes(),
        api.getBills(),
        api.getCategories(),
        api.getTransactions(month),
      ]);

      setDashboard(dashboardData);
      setPlan(planData);
      setIncomes(incomesData);
      setBills(billsData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
    } catch (requestError) {
      setError(requestError.message || "Unable to load MadiBudget data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [month]);

  async function handleCreateIncome(payload) {
    await api.createIncome(payload);
    await loadData();
  }

  async function handleCreateBill(payload) {
    await api.createBill(payload);
    await loadData();
  }

  async function handleCreateCategory(payload) {
    await api.createCategory(payload);
    await loadData();
  }

  async function handleCreateTransaction(payload) {
    await api.createTransaction(payload);
    await loadData();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark">MB</div>
          <div>
            <p className="app-kicker">MadiBudget</p>
            <h1 className="app-title">Household budget workspace</h1>
            <p className="app-subtitle">
              Built to protect required bills, Chapter 13 obligations, and monthly
              category limits before any extra spending happens.
            </p>
          </div>
        </div>

        <div className="header-controls">
          <div className="header-control-card">
            <label className="control-label" htmlFor="planning-month">
              Planning month
            </label>
            <input
              id="planning-month"
              className="month-input"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>

          <div className="header-status-card">
            <span className="status-label">Source of truth</span>
            <strong>Backend-driven budget</strong>
            <span className="status-note">
              Transactions, category balances, and safe-to-spend stay synced to {month}.
            </span>
          </div>
        </div>
      </header>

      {error ? <div className="banner banner-error">{error}</div> : null}
      {loading ? <div className="banner">Loading MadiBudget...</div> : null}

      <Dashboard dashboard={dashboard} plan={plan} month={month} />

      <main className="workspace-grid">
        <section className="stack-column stack-column-secondary">
          <IncomeList incomes={incomes} onCreate={handleCreateIncome} />
          <BillList bills={bills} onCreate={handleCreateBill} />
          <CategoryList categories={categories} onCreate={handleCreateCategory} />
        </section>

        <section className="stack-column stack-column-primary">
          <TransactionForm
            categories={categories}
            onCreate={handleCreateTransaction}
          />
          <TransactionList transactions={transactions} month={month} />
        </section>
      </main>
    </div>
  );
}
