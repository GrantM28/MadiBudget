import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

function averageMonthlyIncome(amount, frequency) {
  const numericAmount = Number(amount || 0);

  if (frequency === "weekly") {
    return (numericAmount * 52) / 12;
  }

  if (frequency === "biweekly") {
    return (numericAmount * 26) / 12;
  }

  return numericAmount;
}

function paychecksInMonth(month, paydayReferenceDate, frequency) {
  if (!paydayReferenceDate) {
    return null;
  }

  if (frequency === "monthly") {
    return 1;
  }

  const intervalDays = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : null;
  if (!intervalDays) {
    return null;
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);
  const anchor = new Date(`${paydayReferenceDate}T12:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const firstIndex = Math.ceil((start.getTime() - anchor.getTime()) / dayMs / intervalDays);
  const lastIndex = Math.floor((end.getTime() - anchor.getTime()) / dayMs / intervalDays);
  return Math.max(0, lastIndex - firstIndex + 1);
}

function monthlyIncomeForMonth(income, month) {
  const count = paychecksInMonth(month, income.payday_reference_date, income.frequency);
  if (count == null) {
    return averageMonthlyIncome(income.amount, income.frequency);
  }

  if (income.frequency === "weekly" || income.frequency === "biweekly") {
    return Number(income.amount || 0) * count;
  }

  return Number(income.amount || 0);
}

const initialIncomeForm = {
  name: "",
  amount: "",
  frequency: "biweekly",
  payday_reference_date: "",
  active: true,
};

const initialAdjustmentForm = {
  description: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
};

export default function IncomeList({
  incomes,
  incomeAdjustments,
  dashboard,
  month,
  onCreate,
  onUpdate,
  onDelete,
  onCreateAdjustment,
  onUpdateAdjustment,
  onDeleteAdjustment,
}) {
  const [incomeForm, setIncomeForm] = useState(initialIncomeForm);
  const [adjustmentForm, setAdjustmentForm] = useState(initialAdjustmentForm);
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [editingAdjustmentId, setEditingAdjustmentId] = useState(null);
  const [submittingIncome, setSubmittingIncome] = useState(false);
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [error, setError] = useState("");

  const sortedIncomes = useMemo(
    () => [...incomes].sort((a, b) => a.name.localeCompare(b.name)),
    [incomes],
  );

  const sortedAdjustments = useMemo(
    () => [...incomeAdjustments].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [incomeAdjustments],
  );

  function resetIncomeForm() {
    setIncomeForm(initialIncomeForm);
    setEditingIncomeId(null);
    setError("");
  }

  function resetAdjustmentForm() {
    setAdjustmentForm({
      ...initialAdjustmentForm,
      date: new Date().toISOString().slice(0, 10),
    });
    setEditingAdjustmentId(null);
    setError("");
  }

  function startIncomeEdit(income) {
    setEditingIncomeId(income.id);
    setIncomeForm({
      name: income.name,
      amount: String(income.amount),
      frequency: income.frequency,
      payday_reference_date: income.payday_reference_date || "",
      active: income.active,
    });
    setError("");
  }

  function startAdjustmentEdit(entry) {
    setEditingAdjustmentId(entry.id);
    setAdjustmentForm({
      description: entry.description,
      amount: String(entry.amount),
      date: entry.date,
    });
    setError("");
  }

  async function handleIncomeSubmit(event) {
    event.preventDefault();
    setSubmittingIncome(true);
    setError("");

    const payload = {
      ...incomeForm,
      amount: Number(incomeForm.amount),
      payday_reference_date: incomeForm.payday_reference_date || null,
    };

    try {
      if (editingIncomeId) {
        await onUpdate(editingIncomeId, payload);
      } else {
        await onCreate(payload);
      }
      resetIncomeForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to save income source.");
    } finally {
      setSubmittingIncome(false);
    }
  }

  async function handleAdjustmentSubmit(event) {
    event.preventDefault();
    setSubmittingAdjustment(true);
    setError("");

    const payload = {
      ...adjustmentForm,
      amount: Number(adjustmentForm.amount),
    };

    try {
      if (editingAdjustmentId) {
        await onUpdateAdjustment(editingAdjustmentId, payload);
      } else {
        await onCreateAdjustment(payload);
      }
      resetAdjustmentForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to save variable income.");
    } finally {
      setSubmittingAdjustment(false);
    }
  }

  async function handleDeleteIncome(income) {
    const confirmed = window.confirm(`Delete income source "${income.name}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await onDelete(income.id);
      if (editingIncomeId === income.id) {
        resetIncomeForm();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete income source.");
    }
  }

  async function handleDeleteAdjustment(entry) {
    const confirmed = window.confirm(`Delete variable income entry "${entry.description}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await onDeleteAdjustment(entry.id);
      if (editingAdjustmentId === entry.id) {
        resetAdjustmentForm();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete variable income.");
    }
  }

  return (
    <div className="ledger-stack">
      <section className="section-card">
        <div className="section-title-row">
          <div>
            <h2>Income Summary</h2>
            <p className="section-subtitle">
              Separate steady recurring income from overtime, commissions, and other extra pay.
            </p>
          </div>
          <span className="section-count">{month}</span>
        </div>

        <div className="summary-stack summary-stack-income">
          <div className="summary-tile">
            <span className="summary-list-label">Recurring Monthly Income</span>
            <strong>{formatMoney(dashboard?.recurring_monthly_income)}</strong>
          </div>

          <div className="summary-tile summary-tile-safe">
            <span className="summary-list-label">Variable Income This Month</span>
            <strong>{formatMoney(dashboard?.variable_income_total)}</strong>
          </div>

          <div className="summary-tile">
            <span className="summary-list-label">Total Income For Budget</span>
            <strong>{formatMoney(dashboard?.monthly_income)}</strong>
          </div>
        </div>
      </section>

      {error ? <div className="form-error form-error-inline">{error}</div> : null}

      <section className="section-card section-card-sheet">
        <div className="section-title-row">
          <div>
            <h2>Recurring Income Sources</h2>
            <p className="section-subtitle">
              Use these for the normal paycheck pattern you expect most months.
            </p>
          </div>
          <span className="section-count">{incomes.length}</span>
        </div>

        <p className="helper-text">
          Add one real payday for weekly or biweekly income so MadiBudget can count extra-check
          months by calendar instead of flattening every month to the same average.
        </p>

        <form className="sheet-entry-form" onSubmit={handleIncomeSubmit}>
          <div className="sheet-entry-grid sheet-entry-grid-income">
            <div className="field">
              <label htmlFor="income-name">Source</label>
              <input
                id="income-name"
                value={incomeForm.name}
                onChange={(event) => setIncomeForm({ ...incomeForm, name: event.target.value })}
                placeholder="Main paycheck"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="income-amount">Amount</label>
              <input
                id="income-amount"
                type="number"
                min="0"
                step="0.01"
                value={incomeForm.amount}
                onChange={(event) => setIncomeForm({ ...incomeForm, amount: event.target.value })}
                placeholder="1500.00"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="income-frequency">Frequency</label>
              <select
                id="income-frequency"
                value={incomeForm.frequency}
                onChange={(event) =>
                  setIncomeForm({ ...incomeForm, frequency: event.target.value })
                }
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="income-payday-reference">Reference Payday</label>
              <input
                id="income-payday-reference"
                type="date"
                value={incomeForm.payday_reference_date}
                onChange={(event) =>
                  setIncomeForm({
                    ...incomeForm,
                    payday_reference_date: event.target.value,
                  })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="income-active">Status</label>
              <select
                id="income-active"
                value={incomeForm.active ? "active" : "inactive"}
                onChange={(event) =>
                  setIncomeForm({ ...incomeForm, active: event.target.value === "active" })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="sheet-entry-actions">
              <div className="action-group action-group-compact">
                <button className="button" type="submit" disabled={submittingIncome}>
                  {submittingIncome
                    ? "Saving..."
                    : editingIncomeId
                      ? "Save Changes"
                      : "Add Income"}
                </button>
                {editingIncomeId ? (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={resetIncomeForm}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </form>

        {sortedIncomes.length === 0 ? (
          <p className="empty-state">No recurring income sources added yet.</p>
        ) : (
          <div className="budget-table-wrap ledger-table-wrap">
            <table className="transaction-table ledger-table">
              <thead>
                <tr>
                  <th className="row-number-column">#</th>
                  <th>Source</th>
                  <th>Frequency</th>
                  <th>Reference Payday</th>
                  <th>Checks</th>
                  <th>Status</th>
                  <th>This Month</th>
                  <th>Amount</th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedIncomes.map((income, index) => {
                  const paychecks = paychecksInMonth(
                    month,
                    income.payday_reference_date,
                    income.frequency,
                  );
                  const monthlyEstimate = monthlyIncomeForMonth(income, month);

                  return (
                    <tr key={income.id}>
                      <td className="row-number-column">{index + 1}</td>
                      <td className="budget-table-category">{income.name}</td>
                      <td>{income.frequency}</td>
                      <td>{income.payday_reference_date || "Not set"}</td>
                      <td>
                        {paychecks == null
                          ? income.frequency === "monthly"
                            ? "1"
                            : "Avg"
                          : paychecks}
                      </td>
                      <td>{income.active ? "Active" : "Inactive"}</td>
                      <td>{formatMoney(monthlyEstimate)}</td>
                      <td>{formatMoney(income.amount)}</td>
                      <td className="actions-column">
                        <div className="action-group">
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => startIncomeEdit(income)}
                          >
                            Edit
                          </button>
                          <button
                            className="table-action-button table-action-button-danger"
                            type="button"
                            onClick={() => handleDeleteIncome(income)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-card section-card-sheet">
        <div className="section-title-row">
          <div>
            <h2>Variable Income This Month</h2>
            <p className="section-subtitle">
              Track overtime, commissions, bonuses, or other extra income only in the month it happens.
            </p>
          </div>
          <span className="section-count">{incomeAdjustments.length}</span>
        </div>

        <form className="sheet-entry-form" onSubmit={handleAdjustmentSubmit}>
          <div className="sheet-entry-grid sheet-entry-grid-variable-income">
            <div className="field">
              <label htmlFor="adjustment-description">Description</label>
              <input
                id="adjustment-description"
                value={adjustmentForm.description}
                onChange={(event) =>
                  setAdjustmentForm({ ...adjustmentForm, description: event.target.value })
                }
                placeholder="Overtime - Harley"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="adjustment-amount">Amount</label>
              <input
                id="adjustment-amount"
                type="number"
                min="0"
                step="0.01"
                value={adjustmentForm.amount}
                onChange={(event) =>
                  setAdjustmentForm({ ...adjustmentForm, amount: event.target.value })
                }
                placeholder="275.00"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="adjustment-date">Date</label>
              <input
                id="adjustment-date"
                type="date"
                value={adjustmentForm.date}
                onChange={(event) =>
                  setAdjustmentForm({ ...adjustmentForm, date: event.target.value })
                }
                required
              />
            </div>

            <div className="sheet-entry-actions">
              <div className="action-group action-group-compact">
                <button className="button" type="submit" disabled={submittingAdjustment}>
                  {submittingAdjustment
                    ? "Saving..."
                    : editingAdjustmentId
                      ? "Save Changes"
                      : "Add Variable Income"}
                </button>
                {editingAdjustmentId ? (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={resetAdjustmentForm}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </form>

        {sortedAdjustments.length === 0 ? (
          <p className="empty-state">No overtime, commissions, or extra income recorded for this month yet.</p>
        ) : (
          <div className="budget-table-wrap ledger-table-wrap">
            <table className="transaction-table ledger-table">
              <thead>
                <tr>
                  <th className="row-number-column">#</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th className="actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAdjustments.map((entry, index) => (
                  <tr key={entry.id}>
                    <td className="row-number-column">{index + 1}</td>
                    <td>{entry.date}</td>
                    <td className="budget-table-category">{entry.description}</td>
                    <td>{formatMoney(entry.amount)}</td>
                    <td className="actions-column">
                      <div className="action-group">
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => startAdjustmentEdit(entry)}
                        >
                          Edit
                        </button>
                        <button
                          className="table-action-button table-action-button-danger"
                          type="button"
                          onClick={() => handleDeleteAdjustment(entry)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
