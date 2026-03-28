import { useEffect, useMemo, useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

const initialForm = {
  name: "",
  amount: "",
  due_day: "",
};

export default function BillList({
  bills,
  month,
  onCreate,
  onUpdate,
  onDelete,
  onSetPayment,
  onClearPayment,
}) {
  const [form, setForm] = useState(initialForm);
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextDrafts = {};
    bills.forEach((bill) => {
      nextDrafts[bill.id] = bill.paid_date || bill.due_date_for_month || todayValue();
    });
    setPaymentDrafts(nextDrafts);
  }, [bills, month]);

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

  const fixedExpenseSummary = useMemo(() => {
    const scheduledTotal = sortedBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
    const paidTotal = sortedBills
      .filter((bill) => bill.is_paid_for_month)
      .reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
    const unpaidCount = sortedBills.filter((bill) => !bill.is_paid_for_month).length;

    return { scheduledTotal, paidTotal, unpaidCount };
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
      setError(submitError.message || "Unable to save fixed expense.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(bill) {
    const confirmed = window.confirm(`Delete fixed expense "${bill.name}"?`);
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
      setError(deleteError.message || "Unable to delete fixed expense.");
    }
  }

  async function handleSetPaidDate(bill) {
    const paidDate = paymentDrafts[bill.id];
    if (!paidDate) {
      setError("Choose a paid date before saving the fixed expense payment.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSetPayment(bill.id, {
        month,
        paid_date: paidDate,
      });
    } catch (submitError) {
      setError(submitError.message || "Unable to save the fixed expense payment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClearPaidDate(bill) {
    const confirmed = window.confirm(
      `Clear the paid date for "${bill.name}" in ${month}? This will also remove the linked transaction row.`,
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onClearPayment(bill.id);
    } catch (submitError) {
      setError(submitError.message || "Unable to clear the fixed expense payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Fixed Expenses</h2>
          <p className="section-subtitle">
            Manage recurring obligations like mortgage, car payments, internet, and phone, then mark them paid for the selected month.
          </p>
        </div>
        <span className="section-count">
          {filteredBills.length}
          {filteredBills.length !== bills.length ? ` / ${bills.length}` : ""}
        </span>
      </div>

      <div className="summary-stack summary-stack-income">
        <div className="summary-tile">
          <span className="summary-list-label">Scheduled This Month</span>
          <strong>{formatMoney(fixedExpenseSummary.scheduledTotal)}</strong>
        </div>

        <div className="summary-tile summary-tile-safe">
          <span className="summary-list-label">Marked Paid</span>
          <strong>{formatMoney(fixedExpenseSummary.paidTotal)}</strong>
        </div>

        <div className="summary-tile summary-tile-warning">
          <span className="summary-list-label">Still Unpaid</span>
          <strong>{fixedExpenseSummary.unpaidCount}</strong>
        </div>
      </div>

      <form className="sheet-entry-form" onSubmit={handleSubmit}>
        <div className="sheet-entry-grid sheet-entry-grid-bills">
          <div className="field">
            <label htmlFor="bill-name">Fixed Expense</label>
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
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Fixed Expense"}
              </button>
              {editingId ? (
                <button className="button button-secondary" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <p className="helper-text">
          Marking a fixed expense paid will automatically create a locked transaction row for the same payment, so you do not have to enter it twice.
        </p>

        {error ? <div className="form-error">{error}</div> : null}
      </form>

      <div className="sheet-entry-form register-toolbar">
        <div className="register-toolbar-grid register-toolbar-grid-bills">
          <div className="field">
            <label htmlFor="bill-search">Search Fixed Expenses</label>
            <input
              id="bill-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by fixed expense name"
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
        <p className="empty-state">No fixed expenses added yet.</p>
      ) : filteredBills.length === 0 ? (
        <p className="empty-state">No fixed expenses match the current search.</p>
      ) : (
        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Fixed Expense</th>
                <th>Due Date</th>
                <th>Paid Date</th>
                <th>Status</th>
                <th>Amount</th>
                <th className="actions-column">Payment</th>
                <th className="actions-column">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill, index) => (
                <tr key={bill.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td className="budget-table-category">{bill.name}</td>
                  <td>{bill.due_date_for_month || `Day ${bill.due_day}`}</td>
                  <td>
                    <input
                      className="inline-row-input"
                      type="date"
                      value={paymentDrafts[bill.id] || ""}
                      onChange={(event) =>
                        setPaymentDrafts((current) => ({
                          ...current,
                          [bill.id]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <span className={`table-pill ${bill.is_paid_for_month ? "paid" : "unpaid"}`}>
                      {bill.is_paid_for_month ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td>{formatMoney(bill.amount)}</td>
                  <td className="actions-column">
                    <div className="action-group">
                      <button
                        className="table-action-button"
                        type="button"
                        onClick={() => handleSetPaidDate(bill)}
                        disabled={submitting}
                      >
                        {bill.is_paid_for_month ? "Update Paid" : "Mark Paid"}
                      </button>
                      {bill.is_paid_for_month ? (
                        <button
                          className="table-action-button table-action-button-danger"
                          type="button"
                          onClick={() => handleClearPaidDate(bill)}
                          disabled={submitting}
                        >
                          Clear Paid
                        </button>
                      ) : null}
                    </div>
                  </td>
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
