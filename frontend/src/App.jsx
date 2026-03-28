import { useEffect, useState } from "react";
import { api } from "./api";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import IncomeList from "./components/IncomeList";
import BillList from "./components/BillList";
import CategoryList from "./components/CategoryList";
import TransactionForm from "./components/TransactionForm";
import TransactionList from "./components/TransactionList";
import Visualize from "./components/Visualize";

function currentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "bills", label: "Fixed Expenses" },
  { id: "income", label: "Income" },
  { id: "categories", label: "Categories" },
  { id: "visualize", label: "Visualize" },
];

export default function App() {
  const [month, setMonth] = useState(currentMonthValue());
  const [activeView, setActiveView] = useState("dashboard");
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [plan, setPlan] = useState(null);
  const [cashPosition, setCashPosition] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [incomeAdjustments, setIncomeAdjustments] = useState([]);
  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function initializeAuth() {
    setAuthLoading(true);
    setError("");

    try {
      const status = await api.getAuthStatus();
      setSetupRequired(status.setup_required);

      if (status.setup_required) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      if (!api.hasAuthToken()) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const me = await api.getMe();
      setCurrentUser(me);
    } catch (requestError) {
      api.clearAuthToken();
      setCurrentUser(null);
      setError(requestError.message || "Unable to verify login.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadData() {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [
        dashboardData,
        planData,
        cashPositionData,
        incomesData,
        incomeAdjustmentsData,
        billsData,
        categoriesData,
        transactionsData,
      ] = await Promise.all([
        api.getDashboard(month),
        api.getPlan(month),
        api.getCashPosition(),
        api.getIncomes(),
        api.getIncomeAdjustments(month),
        api.getBills(month),
        api.getCategories(),
        api.getTransactions(month),
      ]);

      setDashboard(dashboardData);
      setPlan(planData);
      setCashPosition(cashPositionData);
      setIncomes(incomesData);
      setIncomeAdjustments(incomeAdjustmentsData);
      setBills(billsData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
    } catch (requestError) {
      if (requestError.status === 401) {
        api.clearAuthToken();
        setCurrentUser(null);
        setSetupRequired(false);
        setDashboard(null);
        setPlan(null);
        setCashPosition(null);
        setIncomes([]);
        setIncomeAdjustments([]);
        setBills([]);
        setCategories([]);
        setTransactions([]);
      }
      setError(requestError.message || "Unable to load MadiBudget data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    function handleAuthExpired() {
      setCurrentUser(null);
      setDashboard(null);
      setPlan(null);
      setCashPosition(null);
      setIncomes([]);
      setIncomeAdjustments([]);
      setBills([]);
      setCategories([]);
      setTransactions([]);
      setLoading(false);
      setError("Your session expired. Please sign in again.");
    }

    window.addEventListener("madibudget:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("madibudget:auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (!authLoading && currentUser) {
      loadData();
    }
  }, [authLoading, currentUser, month]);

  async function handleSetup(credentials) {
    setAuthSubmitting(true);
    setError("");

    try {
      const session = await api.setupFirstUser(credentials);
      api.setAuthToken(session.access_token);
      setCurrentUser(session.user);
      setSetupRequired(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to create the first login.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogin(credentials) {
    setAuthSubmitting(true);
    setError("");

    try {
      const session = await api.login(credentials);
      api.setAuthToken(session.access_token);
      setCurrentUser(session.user);
      setSetupRequired(false);
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  function handleLogout() {
    api.clearAuthToken();
    setCurrentUser(null);
    setDashboard(null);
    setPlan(null);
    setCashPosition(null);
    setIncomes([]);
    setIncomeAdjustments([]);
    setBills([]);
    setCategories([]);
    setTransactions([]);
    setLoading(false);
    setError("");
  }

  async function handleCreateIncome(payload) {
    await api.createIncome(payload);
    await loadData();
  }

  async function handleUpdateIncome(id, payload) {
    await api.updateIncome(id, payload);
    await loadData();
  }

  async function handleDeleteIncome(id) {
    await api.deleteIncome(id);
    await loadData();
  }

  async function handleCreateIncomeAdjustment(payload) {
    await api.createIncomeAdjustment(payload);
    await loadData();
  }

  async function handleUpdateIncomeAdjustment(id, payload) {
    await api.updateIncomeAdjustment(id, payload);
    await loadData();
  }

  async function handleDeleteIncomeAdjustment(id) {
    await api.deleteIncomeAdjustment(id);
    await loadData();
  }

  async function handleCreateBill(payload) {
    await api.createBill(payload);
    await loadData();
  }

  async function handleUpdateBill(id, payload) {
    await api.updateBill(id, payload);
    await loadData();
  }

  async function handleDeleteBill(id) {
    await api.deleteBill(id);
    await loadData();
  }

  async function handleSetBillPayment(id, payload) {
    await api.setBillPayment(id, payload);
    await loadData();
  }

  async function handleClearBillPayment(id) {
    await api.clearBillPayment(id, month);
    await loadData();
  }

  async function handleCreateCategory(payload) {
    await api.createCategory(payload);
    await loadData();
  }

  async function handleUpdateCategory(id, payload) {
    await api.updateCategory(id, payload);
    await loadData();
  }

  async function handleDeleteCategory(id) {
    await api.deleteCategory(id);
    await loadData();
  }

  async function handleCreateTransaction(payload) {
    await api.createTransaction(payload);
    await loadData();
  }

  async function handleUpdateTransaction(id, payload) {
    await api.updateTransaction(id, payload);
    await loadData();
  }

  async function handleDeleteTransaction(id) {
    await api.deleteTransaction(id);
    await loadData();
  }

  async function handleUpdateCashPosition(payload) {
    await api.updateCashPosition(payload);
    await loadData();
  }

  const activeNav = navItems.find((item) => item.id === activeView);

  if (authLoading) {
    return <div className="auth-loading">Checking secure session...</div>;
  }

  if (!currentUser) {
    return (
      <AuthScreen
        setupRequired={setupRequired}
        submitting={authSubmitting}
        error={error}
        onLogin={handleLogin}
        onSetup={handleSetup}
      />
    );
  }

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
          Track cash flow, protect fixed expenses, and stay inside category limits.
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
            <div className="topbar-controls-stack">
              <div className="topbar-user-row">
                <div>
                  <label className="control-label">Signed In</label>
                  <div className="topbar-user-chip">{currentUser.username}</div>
                </div>
                <button
                  type="button"
                  className="table-action-button"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </div>

              <div>
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
            </div>
          </div>
        </header>

        {error ? <div className="banner banner-error">{error}</div> : null}
        {loading ? <div className="banner">Loading MadiBudget...</div> : null}

        <section className="view-shell">
          {activeView === "dashboard" ? (
            <Dashboard
              dashboard={dashboard}
              plan={plan}
              cashPosition={cashPosition}
              month={month}
              onUpdateCashPosition={handleUpdateCashPosition}
            />
          ) : null}

          {activeView === "transactions" ? (
            <div className="ledger-stack">
              <TransactionForm
                categories={categories}
                onCreate={handleCreateTransaction}
              />
              <TransactionList
                transactions={transactions}
                categories={categories}
                month={month}
                onUpdate={handleUpdateTransaction}
                onDelete={handleDeleteTransaction}
              />
            </div>
          ) : null}

          {activeView === "bills" ? (
            <BillList
              bills={bills}
              month={month}
              onCreate={handleCreateBill}
              onUpdate={handleUpdateBill}
              onDelete={handleDeleteBill}
              onSetPayment={handleSetBillPayment}
              onClearPayment={handleClearBillPayment}
            />
          ) : null}

          {activeView === "income" ? (
            <IncomeList
              incomes={incomes}
              incomeAdjustments={incomeAdjustments}
              dashboard={dashboard}
              month={month}
              onCreate={handleCreateIncome}
              onUpdate={handleUpdateIncome}
              onDelete={handleDeleteIncome}
              onCreateAdjustment={handleCreateIncomeAdjustment}
              onUpdateAdjustment={handleUpdateIncomeAdjustment}
              onDeleteAdjustment={handleDeleteIncomeAdjustment}
            />
          ) : null}

          {activeView === "categories" ? (
            <CategoryList
              categories={categories}
              onCreate={handleCreateCategory}
              onUpdate={handleUpdateCategory}
              onDelete={handleDeleteCategory}
            />
          ) : null}

          {activeView === "visualize" ? (
            <Visualize
              transactions={transactions}
              categories={categories}
              month={month}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
