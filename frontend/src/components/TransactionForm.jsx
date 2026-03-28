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
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Transaction Entry</h2>
          <p className="section-subtitle">
            Add spending rows with the same fields you expect in a worksheet.
          </p>
        </div>
        <span className="section-count">New</span>
      </div>

      <form className="sheet-entry-form" onSubmit={handleSubmit}>
        <div className="sheet-entry-grid sheet-entry-grid-transactions">
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

          <div className="sheet-entry-actions">
            <button
              className="button"
              type="submit"
              disabled={submitting || orderedCategories.length === 0}
            >
              {submitting ? "Saving..." : "Add Row"}
            </button>
          </div>
        </div>

        {orderedCategories.length === 0 ? (
          <p className="helper-text">
            Add categories first. Freeform transaction categories are intentionally disabled.
          </p>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}
      </form>
    </section>
  );
}
