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
import UserManagement from "./components/UserManagement";

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
  { id: "household", label: "Household" },
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
  const [merchantRules, setMerchantRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function clearWorkspace() {
    setDashboard(null);
    setPlan(null);
    setCashPosition(null);
    setIncomes([]);
    setIncomeAdjustments([]);
    setBills([]);
    setCategories([]);
    setTransactions([]);
    setMerchantRules([]);
    setUsers([]);
    setSessions([]);
    setAvatarUrl("");
  }

  async function initializeAuth() {
    setAuthLoading(true);
    setError("");

    try {
      const status = await api.getAuthStatus();
      setSetupRequired(status.setup_required);

      if (status.setup_required) {
        setCurrentUser(null);
        clearWorkspace();
        setLoading(false);
        return;
      }

      if (!api.hasAuthToken()) {
        setCurrentUser(null);
        clearWorkspace();
        setLoading(false);
        return;
      }

      const me = await api.getMe();
      setCurrentUser(me);
    } catch (requestError) {
      api.clearAuthToken();
      setCurrentUser(null);
      clearWorkspace();
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
        merchantRuleData,
        sessionData,
        usersData,
      ] = await Promise.all([
        api.getDashboard(month),
        api.getPlan(month),
        api.getCashPosition(),
        api.getIncomes(),
        api.getIncomeAdjustments(month),
        api.getBills(month),
        api.getCategories(),
        api.getTransactions({ month }),
        api.getMerchantRules(),
        api.getSessions(),
        currentUser.role === "owner" ? api.getUsers() : Promise.resolve([]),
      ]);

      setDashboard(dashboardData);
      setPlan(planData);
      setCashPosition(cashPositionData);
      setIncomes(incomesData);
      setIncomeAdjustments(incomeAdjustmentsData);
      setBills(billsData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
      setMerchantRules(merchantRuleData);
      setSessions(sessionData);
      setUsers(usersData);
    } catch (requestError) {
      if (requestError.status === 401) {
        api.clearAuthToken();
        setCurrentUser(null);
        setSetupRequired(false);
        clearWorkspace();
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
      clearWorkspace();
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

  useEffect(() => {
    let active = true;
    let nextUrl = "";

    async function loadAvatar() {
      if (!currentUser?.has_avatar) {
        setAvatarUrl((current) => {
          if (current) {
            window.URL.revokeObjectURL(current);
          }
          return "";
        });
        return;
      }

      try {
        const blobUrl = await api.getAvatarBlobUrl(currentUser.id);
        if (!active) {
          window.URL.revokeObjectURL(blobUrl);
          return;
        }

        setAvatarUrl((current) => {
          if (current) {
            window.URL.revokeObjectURL(current);
          }
          nextUrl = blobUrl;
          return blobUrl;
        });
      } catch {
        if (active) {
          setAvatarUrl((current) => {
            if (current) {
              window.URL.revokeObjectURL(current);
            }
            return "";
          });
        }
      }
    }

    loadAvatar();

    return () => {
      active = false;
      if (nextUrl) {
        window.URL.revokeObjectURL(nextUrl);
      }
    };
  }, [currentUser?.id, currentUser?.has_avatar]);

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
    clearWorkspace();
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

  async function handleUploadBillReceipt(id, file) {
    await api.uploadBillPaymentReceipt(id, month, file);
    await loadData();
  }

  async function handleDeleteBillReceipt(id) {
    await api.deleteBillPaymentReceipt(id, month);
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

  async function handleUploadTransactionReceipt(id, file) {
    await api.uploadTransactionReceipt(id, file);
    await loadData();
  }

  async function handleDeleteTransactionReceipt(id) {
    await api.deleteTransactionReceipt(id);
    await loadData();
  }

  async function handleUpdateCashPosition(payload) {
    await api.updateCashPosition(payload);
    await loadData();
  }

  async function handleCreateMerchantRule(payload) {
    await api.createMerchantRule(payload);
    await loadData();
  }

  async function handleUpdateMerchantRule(id, payload) {
    await api.updateMerchantRule(id, payload);
    await loadData();
  }

  async function handleDeleteMerchantRule(id) {
    await api.deleteMerchantRule(id);
    await loadData();
  }

  async function handleCreateUser(payload) {
    await api.createUser(payload);
    await loadData();
  }

  async function handleUpdateProfile(payload) {
    const updated = await api.updateMe(payload);
    setCurrentUser(updated);
    await loadData();
  }

  async function handleUploadAvatar(file) {
    const updated = await api.uploadMyAvatar(file);
    setCurrentUser(updated);
    await loadData();
  }

  async function handleDeleteAvatar() {
    const updated = await api.deleteMyAvatar();
    setCurrentUser(updated);
    await loadData();
  }

  async function handleUpdateUser(id, payload) {
    await api.updateUser(id, payload);
    await loadData();
  }

  async function handleResetUserPassword(id, payload) {
    await api.resetUserPassword(id, payload);
    await loadData();
  }

  async function handleDeleteUser(id) {
    await api.deleteUser(id);
    await loadData();
  }

  async function handleChangePassword(payload) {
    await api.changePassword(payload);
    handleLogout();
  }

  async function handleLogoutCurrentSession() {
    await api.logoutCurrentSession();
    handleLogout();
  }

  async function handleLogoutAllSessions() {
    await api.logoutAllSessions();
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
          Track cash flow, protect fixed expenses, group merchants, and stay inside category limits.
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
                  <div className="topbar-user-chip topbar-user-chip-rich">
                    {avatarUrl ? (
                      <img
                        className="user-badge-avatar"
                        src={avatarUrl}
                        alt={`${currentUser.display_name} avatar`}
                      />
                    ) : (
                      <span className="user-badge-initials">{currentUser.initials || "MB"}</span>
                    )}
                    <span className="user-badge-text">
                      <strong>{currentUser.display_name}</strong>
                      <small>@{currentUser.username}</small>
                    </span>
                  </div>
                </div>
                <button type="button" className="table-action-button" onClick={handleLogout}>
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
              <TransactionForm categories={categories} onCreate={handleCreateTransaction} />
              <TransactionList
                transactions={transactions}
                categories={categories}
                merchantRules={merchantRules}
                month={month}
                onUpdate={handleUpdateTransaction}
                onDelete={handleDeleteTransaction}
                onUploadReceipt={handleUploadTransactionReceipt}
                onDeleteReceipt={handleDeleteTransactionReceipt}
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
              onUploadReceipt={handleUploadBillReceipt}
              onDeleteReceipt={handleDeleteBillReceipt}
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
              month={month}
              onCreate={handleCreateCategory}
              onUpdate={handleUpdateCategory}
              onDelete={handleDeleteCategory}
            />
          ) : null}

          {activeView === "visualize" ? (
            <Visualize
              transactions={transactions}
              categories={categories}
              merchantRules={merchantRules}
              month={month}
              onCreateRule={handleCreateMerchantRule}
              onUpdateRule={handleUpdateMerchantRule}
              onDeleteRule={handleDeleteMerchantRule}
            />
          ) : null}

          {activeView === "household" ? (
            <UserManagement
              users={users}
              currentUser={currentUser}
              currentUserAvatarUrl={avatarUrl}
              sessions={sessions}
              onCreateUser={handleCreateUser}
              onUpdateProfile={handleUpdateProfile}
              onUploadAvatar={handleUploadAvatar}
              onDeleteAvatar={handleDeleteAvatar}
              onUpdateUser={handleUpdateUser}
              onResetUserPassword={handleResetUserPassword}
              onDeleteUser={handleDeleteUser}
              onChangePassword={handleChangePassword}
              onLogoutCurrentSession={handleLogoutCurrentSession}
              onLogoutAllSessions={handleLogoutAllSessions}
              onAfterLogoutAll={handleLogout}
            />
          ) : null}
        </section>
      </main>
    </div>
  );
}
