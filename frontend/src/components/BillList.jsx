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
  due_day: "",
};

export default function BillList({ bills, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(initialForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sortedBills = useMemo(
    () => [...bills].sort((a, b) => a.due_day - b.due_day || a.name.localeCompare(b.name)),
    [bills],
  );

  const filteredBills = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) {
      return sortedBills;
    }

    return sortedBills.filter((bill) => bill.name.toLowerCase().includes(search));
  }, [sortedBills, searchQuery]);

  const billSummary = useMemo(() => {
    const total = sortedBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
    const earlyMonthCount = sortedBills.filter((bill) => Number(bill.due_day) <= 10).length;
    const largestBill =
      [...sortedBills].sort((a, b) => Number(b.amount) - Number(a.amount))[0] || null;

    return { total, earlyMonthCount, largestBill };
  }, [sortedBills]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  function startEdit(bill) {
    setEditingId(bill.id);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      due_day: String(bill.due_day),
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
      due_day: Number(form.due_day),
      recurring: true,
      type: "bill",
    };

    try {
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      resetForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to save bill.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(bill) {
    const confirmed = window.confirm(`Delete bill "${bill.name}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await onDelete(bill.id);
      if (editingId === bill.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete bill.");
    }
  }

  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Bills</h2>
          <p className="section-subtitle">
            Enter, edit, and organize recurring monthly bills in a worksheet-style schedule.
          </p>
        </div>
        <span className="section-count">
          {filteredBills.length}
          {filteredBills.length !== bills.length ? ` / ${bills.length}` : ""}
        </span>
      </div>

      <div className="summary-stack summary-stack-income">
        <div className="summary-tile">
          <span className="summary-list-label">Monthly Bill Load</span>
          <strong>{formatMoney(billSummary.total)}</strong>
        </div>

        <div className="summary-tile summary-tile-warning">
          <span className="summary-list-label">Due In Days 1-10</span>
          <strong>{billSummary.earlyMonthCount}</strong>
        </div>

        <div className="summary-tile">
          <span className="summary-list-label">Largest Bill</span>
          <strong>
            {billSummary.largestBill
              ? `${billSummary.largestBill.name} - ${formatMoney(billSummary.largestBill.amount)}`
              : "None"}
          </strong>
        </div>
      </div>

      <form className="sheet-entry-form" onSubmit={handleSubmit}>
        <div className="sheet-entry-grid sheet-entry-grid-bills">
          <div className="field">
            <label htmlFor="bill-name">Bill Name</label>
            <input
              id="bill-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Mortgage"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="bill-amount">Amount</label>
            <input
              id="bill-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="1200.00"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="bill-due-day">Due Day</label>
            <input
              id="bill-due-day"
              type="number"
              min="1"
              max="31"
              value={form.due_day}
              onChange={(event) => setForm({ ...form, due_day: event.target.value })}
              placeholder="1"
              required
            />
          </div>

          <div className="sheet-entry-actions">
            <div className="action-group action-group-compact">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Bill"}
              </button>
              {editingId ? (
                <button className="button button-secondary" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}
      </form>

      <div className="sheet-entry-form register-toolbar">
        <div className="register-toolbar-grid register-toolbar-grid-bills">
          <div className="field">
            <label htmlFor="bill-search">Search Bills</label>
            <input
              id="bill-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by bill name"
            />
          </div>

          <div className="sheet-entry-actions">
            <div className="action-group action-group-compact">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {sortedBills.length === 0 ? (
        <p className="empty-state">No bills added yet.</p>
      ) : filteredBills.length === 0 ? (
        <p className="empty-state">No bills match the current search.</p>
      ) : (
        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Bill</th>
                <th>Due Day</th>
                <th>Status</th>
                <th>Amount</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill, index) => (
                <tr key={bill.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td className="budget-table-category">{bill.name}</td>
                  <td>{bill.due_day}</td>
                  <td>{bill.recurring ? "Recurring" : "One-time"}</td>
                  <td>{formatMoney(bill.amount)}</td>
                  <td className="actions-column">
                    <div className="action-group">
                      <button
                        className="table-action-button"
                        type="button"
                        onClick={() => startEdit(bill)}
                      >
                        Edit
                      </button>
                      <button
                        className="table-action-button table-action-button-danger"
                        type="button"
                        onClick={() => handleDelete(bill)}
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
