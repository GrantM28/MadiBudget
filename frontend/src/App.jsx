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

const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "bills", label: "Bills" },
  { id: "income", label: "Income" },
  { id: "categories", label: "Categories" },
];

export default function App() {
  const [month, setMonth] = useState(currentMonthValue());
  const [activeView, setActiveView] = useState("dashboard");
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

  const activeNav = navItems.find((item) => item.id === activeView);

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">MB</div>
          <div>
            <div className="sidebar-title">MadiBudget</div>
            <div className="sidebar-subtitle">Household budgeting</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${activeView === item.id ? "active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footnote">
          Track cash flow, protect bills, and stay inside category limits.
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <div>
            <p className="section-kicker">Workspace</p>
            <h1 className="topbar-title">{activeNav?.label || "Dashboard"}</h1>
            <p className="topbar-subtitle">
              Budget data for {month} with backend-driven balances and summaries.
            </p>
          </div>

          <div className="topbar-controls">
            <label className="control-label" htmlFor="planning-month">
              Month
            </label>
            <input
              id="planning-month"
              className="month-input"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        </header>

        {error ? <div className="banner banner-error">{error}</div> : null}
        {loading ? <div className="banner">Loading MadiBudget...</div> : null}

        <section className="view-shell">
          {activeView === "dashboard" ? (
            <Dashboard dashboard={dashboard} plan={plan} month={month} />
          ) : null}

          {activeView === "transactions" ? (
            <div className="ledger-stack">
              <TransactionForm
                categories={categories}
                onCreate={handleCreateTransaction}
              />
              <TransactionList transactions={transactions} month={month} />
            </div>
          ) : null}

          {activeView === "bills" ? (
            <BillList bills={bills} onCreate={handleCreateBill} />
          ) : null}

          {activeView === "income" ? (
            <IncomeList incomes={incomes} onCreate={handleCreateIncome} />
          ) : null}

          {activeView === "categories" ? (
            <CategoryList categories={categories} onCreate={handleCreateCategory} />
          ) : null}
        </section>
      </main>
    </div>
  );
}
