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
      <div className="background-glow background-glow-left" />
      <div className="background-glow background-glow-right" />

      <header className="hero">
        <div>
          <p className="eyebrow">MadiBudget</p>
          <h1>Cash-flow clarity for a Chapter 13 household.</h1>
          <p className="hero-copy">
            Track income, bills, category spending, and the amount you can safely
            spend without undercutting required obligations.
          </p>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-label">Planning Month</div>
          <input
            className="month-input"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <p className="hero-panel-copy">
            Transactions and dashboard numbers stay aligned to the selected month.
          </p>
        </div>
      </header>

      {error ? <div className="banner banner-error">{error}</div> : null}
      {loading ? <div className="banner">Loading MadiBudget...</div> : null}

      <Dashboard dashboard={dashboard} plan={plan} month={month} />

      <main className="content-grid">
        <section className="stack-column">
          <IncomeList incomes={incomes} onCreate={handleCreateIncome} />
          <BillList bills={bills} onCreate={handleCreateBill} />
          <CategoryList categories={categories} onCreate={handleCreateCategory} />
        </section>

        <section className="stack-column">
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
