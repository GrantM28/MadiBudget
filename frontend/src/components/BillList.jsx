import { useState } from "react";

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

export default function BillList({ bills, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await onCreate({
        ...form,
        amount: Number(form.amount),
        due_day: Number(form.due_day),
        recurring: true,
        type: "bill",
      });
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.message || "Unable to save bill.");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedBills = [...bills].sort((a, b) => a.due_day - b.due_day || a.name.localeCompare(b.name));

  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Bills</h2>
          <p className="section-subtitle">
            Enter and review recurring monthly bills in a worksheet-style schedule.
          </p>
        </div>
        <span className="section-count">{bills.length}</span>
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
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Add Bill"}
            </button>
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}
      </form>

      {sortedBills.length === 0 ? (
        <p className="empty-state">No bills added yet.</p>
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
              </tr>
            </thead>
            <tbody>
              {sortedBills.map((bill, index) => (
                <tr key={bill.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td className="budget-table-category">{bill.name}</td>
                  <td>{bill.due_day}</td>
                  <td>{bill.recurring ? "Recurring" : "One-time"}</td>
                  <td>{formatMoney(bill.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
