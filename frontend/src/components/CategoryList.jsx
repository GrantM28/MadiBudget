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
  monthly_budget: "",
};

export default function CategoryList({ categories, onCreate }) {
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
        monthly_budget: Number(form.monthly_budget),
      });
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.message || "Unable to save category.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section-card">
      <div className="section-title-row">
        <div>
          <h2>Allowance Categories</h2>
          <p className="section-subtitle">Every transaction must use one of these categories.</p>
        </div>
        <span className="section-count">{categories.length}</span>
      </div>

      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="category-name">Category Name</label>
            <input
              id="category-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Groceries"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="category-budget">Monthly Budget</label>
            <input
              id="category-budget"
              type="number"
              min="0"
              step="0.01"
              value={form.monthly_budget}
              onChange={(event) => setForm({ ...form, monthly_budget: event.target.value })}
              placeholder="500.00"
              required
            />
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="button-row">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Add Category"}
          </button>
        </div>
      </form>

      {categories.length === 0 ? (
        <p className="empty-state">No allowance categories added yet.</p>
      ) : (
        <ul className="item-list compact-list">
          {categories.map((category) => (
            <li className="list-item" key={category.id}>
              <div className="list-item-main">
                <div className="list-item-title">{category.name}</div>
                <div className="list-item-subtitle">Monthly allowance budget</div>
              </div>
              <div className="list-item-amount">{formatMoney(category.monthly_budget)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
