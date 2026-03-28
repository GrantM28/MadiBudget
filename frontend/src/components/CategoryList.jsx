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
  monthly_budget: "",
};

export default function CategoryList({ categories, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  function startEdit(category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      monthly_budget: String(category.monthly_budget),
    });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      ...form,
      monthly_budget: Number(form.monthly_budget),
    };

    try {
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      resetForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to save category.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(category) {
    const confirmed = window.confirm(`Delete category "${category.name}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await onDelete(category.id);
      if (editingId === category.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete category.");
    }
  }

  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Allowance Categories</h2>
          <p className="section-subtitle">
            Manage the budget categories that every transaction must use.
          </p>
        </div>
        <span className="section-count">{categories.length}</span>
      </div>

      <form className="sheet-entry-form" onSubmit={handleSubmit}>
        <div className="sheet-entry-grid sheet-entry-grid-categories">
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

          <div className="sheet-entry-actions">
            <div className="action-group action-group-compact">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Category"}
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

      {sortedCategories.length === 0 ? (
        <p className="empty-state">No allowance categories added yet.</p>
      ) : (
        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Category</th>
                <th>Monthly Budget</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((category, index) => (
                <tr key={category.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td className="budget-table-category">{category.name}</td>
                  <td>{formatMoney(category.monthly_budget)}</td>
                  <td className="actions-column">
                    <div className="action-group">
                      <button
                        className="table-action-button"
                        type="button"
                        onClick={() => startEdit(category)}
                      >
                        Edit
                      </button>
                      <button
                        className="table-action-button table-action-button-danger"
                        type="button"
                        onClick={() => handleDelete(category)}
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
