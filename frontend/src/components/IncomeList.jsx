import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

const initialForm = {
  name: "",
  amount: "",
  frequency: "biweekly",
  active: true,
};

export default function IncomeList({ incomes, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sortedIncomes = useMemo(
    () => [...incomes].sort((a, b) => a.name.localeCompare(b.name)),
    [incomes],
  );

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  function startEdit(income) {
    setEditingId(income.id);
    setForm({
      name: income.name,
      amount: String(income.amount),
      frequency: income.frequency,
      active: income.active,
    });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      ...form,
      amount: Number(form.amount),
    };

    try {
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      resetForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to save income source.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(income) {
    const confirmed = window.confirm(`Delete income source "${income.name}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await onDelete(income.id);
      if (editingId === income.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete income source.");
    }
  }

  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Income Sources</h2>
          <p className="section-subtitle">
            Add, edit, and manage the pay sources used in monthly cash-flow calculations.
          </p>
        </div>
        <span className="section-count">{incomes.length}</span>
      </div>

      <form className="sheet-entry-form" onSubmit={handleSubmit}>
        <div className="sheet-entry-grid sheet-entry-grid-income">
          <div className="field">
            <label htmlFor="income-name">Source</label>
            <input
              id="income-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
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
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="1500.00"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="income-frequency">Frequency</label>
            <select
              id="income-frequency"
              value={form.frequency}
              onChange={(event) => setForm({ ...form, frequency: event.target.value })}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="income-active">Status</label>
            <select
              id="income-active"
              value={form.active ? "active" : "inactive"}
              onChange={(event) =>
                setForm({ ...form, active: event.target.value === "active" })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="sheet-entry-actions">
            <div className="action-group action-group-compact">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Income"}
              </button>
              {editingId ? (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}
      </form>

      {sortedIncomes.length === 0 ? (
        <p className="empty-state">No income sources added yet.</p>
      ) : (
        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Source</th>
                <th>Frequency</th>
                <th>Status</th>
                <th>Amount</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedIncomes.map((income, index) => (
                <tr key={income.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td className="budget-table-category">{income.name}</td>
                  <td>{income.frequency}</td>
                  <td>{income.active ? "Active" : "Inactive"}</td>
                  <td>{formatMoney(income.amount)}</td>
                  <td className="actions-column">
                    <div className="action-group">
                      <button
                        className="table-action-button"
                        type="button"
                        onClick={() => startEdit(income)}
                      >
                        Edit
                      </button>
                      <button
                        className="table-action-button table-action-button-danger"
                        type="button"
                        onClick={() => handleDelete(income)}
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
  );
}
