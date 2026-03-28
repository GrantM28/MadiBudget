import { useMemo, useState } from "react";
import { api } from "../api";

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
  budget_mode: "monthly_reset",
  starting_balance: "0",
};

export default function CategoryList({ categories, month, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(initialForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return sortedCategories.filter((category) => {
      const matchesSearch = !search || category.name.toLowerCase().includes(search);
      const matchesMode = modeFilter === "all" || category.budget_mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [sortedCategories, searchQuery, modeFilter]);

  const categorySummary = useMemo(() => {
    const totalBudget = sortedCategories.reduce(
      (sum, category) => sum + Number(category.monthly_budget || 0),
      0,
    );
    const rolloverCount = sortedCategories.filter(
      (category) => category.budget_mode !== "monthly_reset",
    ).length;
    return { totalBudget, rolloverCount };
  }, [sortedCategories]);

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
      budget_mode: category.budget_mode,
      starting_balance: String(category.starting_balance ?? 0),
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
      starting_balance: Number(form.starting_balance || 0),
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
            Monthly reset categories start fresh. Rollover and sinking fund categories carry money forward.
          </p>
        </div>
        <span className="section-count">
          {filteredCategories.length}
          {filteredCategories.length !== categories.length ? ` / ${categories.length}` : ""}
        </span>
      </div>

      <div className="summary-stack summary-stack-income">
        <div className="summary-tile">
          <span className="summary-list-label">Total Monthly Budgeted</span>
          <strong>{formatMoney(categorySummary.totalBudget)}</strong>
        </div>

        <div className="summary-tile">
          <span className="summary-list-label">Carryover Categories</span>
          <strong>{categorySummary.rolloverCount}</strong>
        </div>

        <div className="summary-tile summary-tile-safe">
          <span className="summary-list-label">Export</span>
          <button className="button button-secondary" type="button" onClick={() => api.exportCategoriesCsv(month)}>
            Download CSV
          </button>
        </div>
      </div>

      <form className="sheet-entry-form" onSubmit={handleSubmit}>
        <div className="sheet-entry-grid sheet-entry-grid-categories-advanced">
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

          <div className="field">
            <label htmlFor="category-mode">Mode</label>
            <select
              id="category-mode"
              value={form.budget_mode}
              onChange={(event) => setForm({ ...form, budget_mode: event.target.value })}
            >
              <option value="monthly_reset">Monthly Reset</option>
              <option value="rollover">Rollover</option>
              <option value="sinking_fund">Sinking Fund</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="category-starting-balance">Starting Balance</label>
            <input
              id="category-starting-balance"
              type="number"
              step="0.01"
              value={form.starting_balance}
              onChange={(event) => setForm({ ...form, starting_balance: event.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="sheet-entry-actions">
            <div className="action-group action-group-compact">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Category"}
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
        <div className="register-toolbar-grid register-toolbar-grid-categories">
          <div className="field">
            <label htmlFor="category-search">Search Categories</label>
            <input
              id="category-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search category names"
            />
          </div>

          <div className="field">
            <label htmlFor="category-mode-filter">Mode</label>
            <select
              id="category-mode-filter"
              value={modeFilter}
              onChange={(event) => setModeFilter(event.target.value)}
            >
              <option value="all">All modes</option>
              <option value="monthly_reset">Monthly Reset</option>
              <option value="rollover">Rollover</option>
              <option value="sinking_fund">Sinking Fund</option>
            </select>
          </div>

          <div className="sheet-entry-actions">
            <button className="button button-secondary" type="button" onClick={() => {
              setSearchQuery("");
              setModeFilter("all");
            }}>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="budget-table-wrap ledger-table-wrap">
        <table className="transaction-table ledger-table">
          <thead>
            <tr>
              <th className="row-number-column">#</th>
              <th>Category</th>
              <th>Mode</th>
              <th>Monthly Budget</th>
              <th>Starting Balance</th>
              <th className="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCategories.map((category, index) => (
              <tr key={category.id}>
                <td className="row-number-column">{index + 1}</td>
                <td className="budget-table-category">{category.name}</td>
                <td>{category.budget_mode.replaceAll("_", " ")}</td>
                <td>{formatMoney(category.monthly_budget)}</td>
                <td>{formatMoney(category.starting_balance)}</td>
                <td className="actions-column">
                  <div className="action-group">
                    <button className="table-action-button" type="button" onClick={() => startEdit(category)}>
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
    </section>
  );
}
