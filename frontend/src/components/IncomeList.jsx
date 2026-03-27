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
  frequency: "biweekly",
};

export default function IncomeList({ incomes, onCreate }) {
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
        active: true,
      });
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.message || "Unable to save income source.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section-card">
      <div className="section-title-row">
        <div>
          <h2>Income Sources</h2>
          <p className="section-subtitle">Regular pay sources converted into monthly cash flow.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="income-name">Name</label>
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

        {error ? <div className="form-error">{error}</div> : null}

        <div className="button-row">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Add Income Source"}
          </button>
        </div>
      </form>

      {incomes.length === 0 ? (
        <p className="empty-state">No income sources added yet.</p>
      ) : (
        <ul className="item-list">
          {incomes.map((income) => (
            <li className="list-item" key={income.id}>
              <div>
                <div className="list-item-title">{income.name}</div>
                <div className="list-item-subtitle">
                  {income.frequency} {income.active ? "• active" : "• inactive"}
                </div>
              </div>
              <div className="list-item-amount">{formatMoney(income.amount)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
