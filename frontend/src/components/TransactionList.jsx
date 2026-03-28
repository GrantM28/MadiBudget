import { useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return currency.format(Number(value || 0));
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function startEdit(transaction) {
    setEditingId(transaction.id);
    setEditForm({
      description: transaction.description,
      amount: String(transaction.amount),
      date: transaction.date,
      category_id: String(transaction.category_id),
    });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setError("");
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
            Worksheet view of all spending recorded for {month}, with inline editing.
          </p>
        </div>
        <span className="section-count">{transactions.length}</span>
      </div>

      {error ? <div className="form-error form-error-inline">{error}</div> : null}

      {transactions.length === 0 ? (
        <p className="empty-state">No transactions recorded for this month yet.</p>
      ) : (
        <div className="budget-table-wrap ledger-table-wrap">
          <table className="transaction-table ledger-table">
            <thead>
              <tr>
                <th className="row-number-column">#</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction, index) => {
                const isEditing = editingId === transaction.id;

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
                        transaction.category_name
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
                        formatMoney(transaction.amount)
                      )}
                    </td>
                    <td className="actions-column">
                      <div className="action-group">
                        {isEditing ? (
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
                          <button
                            className="table-action-button"
                            type="button"
                            onClick={() => startEdit(transaction)}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          className="table-action-button table-action-button-danger"
                          type="button"
                          onClick={() => handleDelete(transaction)}
                          disabled={submitting && isEditing}
                        >
                          Delete
                        </button>
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
