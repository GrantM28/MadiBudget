import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

function formatSignedMoney(amount, transactionType) {
  const sign = transactionType === "income" ? "+" : "-";
  return `${sign}${formatMoney(amount)}`;
}

export default function TransactionList({
  transactions,
  categories,
  month,
  onUpdate,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const filteredTransactions = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const bucketLabel =
        transaction.category_name ||
        transaction.fixed_expense_name ||
        (transaction.source_type === "fixed_expense" ? "Fixed Expense" : "");
      const matchesSearch =
        !search ||
        transaction.description.toLowerCase().includes(search) ||
        bucketLabel.toLowerCase().includes(search);
      const matchesType = typeFilter === "all" || transaction.transaction_type === typeFilter;
      const matchesBucket =
        bucketFilter === "all" ||
        (bucketFilter === "__fixed_expenses__" && transaction.source_type === "fixed_expense") ||
        String(transaction.category_id) === bucketFilter;

      return matchesSearch && matchesType && matchesBucket;
    });
  }, [transactions, searchQuery, typeFilter, bucketFilter]);

  const transactionTotals = useMemo(() => {
    return filteredTransactions.reduce(
      (totals, transaction) => {
        const amount = Number(transaction.amount || 0);

        if (transaction.transaction_type === "income") {
          totals.moneyIn += amount;
        } else {
          totals.spent += amount;
        }

        totals.net = totals.moneyIn - totals.spent;
        return totals;
      },
      { spent: 0, moneyIn: 0, net: 0 },
    );
  }, [filteredTransactions]);

  function startEdit(transaction) {
    if (transaction.locked) {
      setError("Fixed expense payment rows are edited from Fixed Expenses.");
      return;
    }

    setEditingId(transaction.id);
    setEditForm({
      description: transaction.description,
      amount: String(transaction.amount),
      date: transaction.date,
      transaction_type: transaction.transaction_type,
      category_id: String(transaction.category_id),
    });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setError("");
  }

  function clearFilters() {
    setSearchQuery("");
    setTypeFilter("all");
    setBucketFilter("all");
  }

  async function handleSave(transactionId) {
    if (!editForm?.category_id) {
      setError("Choose a valid category before saving the transaction.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onUpdate(transactionId, {
        ...editForm,
        amount: Number(editForm.amount),
        category_id: Number(editForm.category_id),
      });
      cancelEdit();
    } catch (saveError) {
      setError(saveError.message || "Unable to update transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(transaction) {
    const confirmed = window.confirm(`Delete transaction "${transaction.description}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await onDelete(transaction.id);
      if (editingId === transaction.id) {
        cancelEdit();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete transaction.");
    }
  }

  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Transaction Register</h2>
          <p className="section-subtitle">
            Ledger view of all cash activity for {month}, including fixed expenses that were marked paid.
          </p>
        </div>
        <span className="section-count">
          {filteredTransactions.length}
          {filteredTransactions.length !== transactions.length ? ` / ${transactions.length}` : ""}
        </span>
      </div>

      <div className="summary-stack summary-stack-income">
        <div className="summary-tile">
          <span className="summary-list-label">Filtered Spend</span>
          <strong>{formatMoney(transactionTotals.spent)}</strong>
        </div>

        <div className="summary-tile summary-tile-safe">
          <span className="summary-list-label">Filtered Money In</span>
          <strong>{formatMoney(transactionTotals.moneyIn)}</strong>
        </div>

        <div
          className={`summary-tile ${
            transactionTotals.net < 0 ? "summary-tile-warning" : ""
          }`}
        >
          <span className="summary-list-label">Filtered Net Flow</span>
          <strong>{formatMoney(transactionTotals.net)}</strong>
        </div>
      </div>

      <div className="sheet-entry-form register-toolbar">
        <div className="register-toolbar-grid">
          <div className="field">
            <label htmlFor="transaction-search">Search</label>
            <input
              id="transaction-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search merchant, fixed expense, or category"
            />
          </div>

          <div className="field">
            <label htmlFor="transaction-type-filter">Type</label>
            <select
              id="transaction-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Money In / Refunds</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="transaction-category-filter">Bucket</label>
            <select
              id="transaction-category-filter"
              value={bucketFilter}
              onChange={(event) => setBucketFilter(event.target.value)}
            >
              <option value="all">All buckets</option>
              <option value="__fixed_expenses__">Fixed expenses</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sheet-entry-actions">
            <div className="action-group action-group-compact">
              <button className="button button-secondary" type="button" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="form-error form-error-inline">{error}</div> : null}

      {transactions.length === 0 ? (
        <p className="empty-state">No transactions recorded for this month yet.</p>
      ) : filteredTransactions.length === 0 ? (
        <p className="empty-state">No transactions match the current filters.</p>
      ) : (
        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Date</th>
                <th>Description</th>
                <th>Bucket</th>
                <th>Source</th>
                <th>Type</th>
                <th>Amount</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction, index) => {
                const isEditing = editingId === transaction.id;
                const bucketLabel =
                  transaction.category_name || transaction.fixed_expense_name || "Not assigned";

                return (
                  <tr key={transaction.id}>
                    <td className="row-number-column">{index + 1}</td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-row-input"
                          type="date"
                          value={editForm.date}
                          onChange={(event) =>
                            setEditForm({ ...editForm, date: event.target.value })
                          }
                        />
                      ) : (
                        transaction.date
                      )}
                    </td>
                    <td className="budget-table-category">
                      {isEditing ? (
                        <input
                          className="inline-row-input"
                          value={editForm.description}
                          onChange={(event) =>
                            setEditForm({ ...editForm, description: event.target.value })
                          }
                        />
                      ) : (
                        transaction.description
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="inline-row-select"
                          value={editForm.category_id}
                          onChange={(event) =>
                            setEditForm({ ...editForm, category_id: event.target.value })
                          }
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        bucketLabel
                      )}
                    </td>
                    <td>
                      <span
                        className={`table-pill ${
                          transaction.source_type === "fixed_expense" ? "fixed-expense" : "allowance"
                        }`}
                      >
                        {transaction.source_type === "fixed_expense" ? "Fixed Expense" : "Allowance"}
                      </span>
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="inline-row-select"
                          value={editForm.transaction_type}
                          onChange={(event) =>
                            setEditForm({ ...editForm, transaction_type: event.target.value })
                          }
                        >
                          <option value="expense">Expense</option>
                          <option value="income">Money In / Refund</option>
                        </select>
                      ) : transaction.transaction_type === "income" ? (
                        "Money In"
                      ) : (
                        "Expense"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-row-input inline-row-input-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(event) =>
                            setEditForm({ ...editForm, amount: event.target.value })
                          }
                        />
                      ) : (
                        <span
                          className={
                            transaction.transaction_type === "income"
                              ? "transaction-amount-positive"
                              : "transaction-amount-negative"
                          }
                        >
                          {formatSignedMoney(transaction.amount, transaction.transaction_type)}
                        </span>
                      )}
                    </td>
                    <td className="actions-column">
                      <div className="action-group">
                        {transaction.locked ? (
                          <span className="table-note">Managed in Fixed Expenses</span>
                        ) : isEditing ? (
                          <>
                            <button
                              className="table-action-button"
                              type="button"
                              onClick={() => handleSave(transaction.id)}
                              disabled={submitting}
                            >
                              Save
                            </button>
                            <button
                              className="table-action-button"
                              type="button"
                              onClick={cancelEdit}
                              disabled={submitting}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="table-action-button"
                              type="button"
                              onClick={() => startEdit(transaction)}
                            >
                              Edit
                            </button>
                            <button
                              className="table-action-button table-action-button-danger"
                              type="button"
                              onClick={() => handleDelete(transaction)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
