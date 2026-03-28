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

  return (
    <section className="section-card">
      <div className="section-title-row">
        <div>
          <h2>Bills</h2>
          <p className="section-subtitle">Track monthly bills, loans, mortgage, utilities, and other obligations.</p>
        </div>
        <span className="section-count">{bills.length}</span>
      </div>

      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="bill-name">Name</label>
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

        {error ? <div className="form-error">{error}</div> : null}

        <div className="button-row">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Add Bill"}
          </button>
        </div>
      </form>

      {bills.length === 0 ? (
        <p className="empty-state">No bills added yet.</p>
      ) : (
        <ul className="item-list compact-list">
          {bills.map((bill) => (
            <li className="list-item" key={bill.id}>
              <div className="list-item-main">
                <div className="list-item-title">{bill.name}</div>
                <div className="list-item-subtitle">Due day {bill.due_day}</div>
              </div>
              <div className="list-item-amount">{formatMoney(bill.amount)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
