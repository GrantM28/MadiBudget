import { useState } from "react";

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

const initialForm = {
  description: "",
  amount: "",
  date: todayValue(),
  category_id: "",
};

export default function TransactionForm({ categories, onCreate }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const orderedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.category_id) {
      setError("Choose an existing allowance category before saving a transaction.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onCreate({
        ...form,
        amount: Number(form.amount),
        category_id: Number(form.category_id),
      });
      setForm({
        ...initialForm,
        date: todayValue(),
        category_id: orderedCategories[0]?.id ? String(orderedCategories[0].id) : "",
      });
    } catch (submitError) {
      setError(submitError.message || "Unable to save transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section-card">
      <div className="section-title-row">
        <div>
          <h2>Add Transaction</h2>
          <p className="section-subtitle">
            Transactions are always assigned to an existing allowance category.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="transaction-description">Description</label>
          <input
            id="transaction-description"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Walmart grocery run"
            required
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="transaction-amount">Amount</label>
            <input
              id="transaction-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="87.45"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="transaction-date">Date</label>
            <input
              id="transaction-date"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="transaction-category">Category</label>
          <select
            id="transaction-category"
            value={form.category_id}
            onChange={(event) => setForm({ ...form, category_id: event.target.value })}
            disabled={orderedCategories.length === 0}
            required
          >
            <option value="">Select a category</option>
            {orderedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {orderedCategories.length === 0 ? (
          <p className="helper-text">
            Add or seed allowance categories first. Freeform transaction categories are disabled by design.
          </p>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}

        <div className="button-row">
          <button
            className="button"
            type="submit"
            disabled={submitting || orderedCategories.length === 0}
          >
            {submitting ? "Saving..." : "Add Transaction"}
          </button>
        </div>
      </form>
    </section>
  );
}
