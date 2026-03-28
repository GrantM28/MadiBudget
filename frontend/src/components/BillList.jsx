import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  return currency.format(Number(value || 0));
}

const initialForm = {
  name: "",
  amount: "",
  due_day: "",
};

export default function BillList({
  bills,
  month,
  onCreate,
  onUpdate,
  onDelete,
  onSetPayment,
  onClearPayment,
  onUploadReceipt,
  onDeleteReceipt,
}) {
  const [form, setForm] = useState(initialForm);
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRefs = useRef({});

  useEffect(() => {
    const nextDrafts = {};
    bills.forEach((bill) => {
      nextDrafts[bill.id] = {
        paid_date: bill.paid_date || bill.due_date_for_month || todayValue(),
        note: bill.payment_note || "",
      };
    });
    setPaymentDrafts(nextDrafts);
  }, [bills, month]);

  const filteredBills = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return [...bills]
      .sort((a, b) => a.due_day - b.due_day || a.name.localeCompare(b.name))
      .filter((bill) => {
        const matchesSearch = !search || bill.name.toLowerCase().includes(search);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "paid" && bill.is_paid_for_month) ||
          (statusFilter === "unpaid" && !bill.is_paid_for_month);
        return matchesSearch && matchesStatus;
      });
  }, [bills, searchQuery, statusFilter]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  function startEdit(bill) {
    setEditingId(bill.id);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      due_day: String(bill.due_day),
    });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      ...form,
      amount: Number(form.amount),
      due_day: Number(form.due_day),
      recurring: true,
      type: "bill",
    };

    try {
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      resetForm();
    } catch (submitError) {
      setError(submitError.message || "Unable to save fixed expense.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(bill) {
    const confirmed = window.confirm(`Delete fixed expense "${bill.name}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    try {
      await onDelete(bill.id);
      if (editingId === bill.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete fixed expense.");
    }
  }

  async function handleSetPaidDate(bill) {
    const draft = paymentDrafts[bill.id];
    if (!draft?.paid_date) {
      setError("Choose a paid date before saving the fixed expense payment.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSetPayment(bill.id, {
        month,
        paid_date: draft.paid_date,
        note: draft.note,
      });
    } catch (submitError) {
      setError(submitError.message || "Unable to save the fixed expense payment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClearPaidDate(bill) {
    const confirmed = window.confirm(
      `Clear the paid date for "${bill.name}" in ${month}? This will also remove the linked transaction row.`,
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onClearPayment(bill.id);
    } catch (submitError) {
      setError(submitError.message || "Unable to clear the fixed expense payment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadReceipt(bill, event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await onUploadReceipt(bill.id, file);
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload receipt.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section className="section-card section-card-sheet">
      <div className="section-title-row">
        <div>
          <h2>Fixed Expenses</h2>
          <p className="section-subtitle">
            Track due dates, paid dates, payment notes, and receipt files without double-counting.
          </p>
        </div>
        <span className="section-count">{filteredBills.length}</span>
      </div>

      <div className="summary-stack summary-stack-income">
        <div className="summary-tile">
          <span className="summary-list-label">Scheduled This Month</span>
          <strong>{formatMoney(bills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0))}</strong>
        </div>
        <div className="summary-tile summary-tile-safe">
          <span className="summary-list-label">Marked Paid</span>
          <strong>{bills.filter((bill) => bill.is_paid_for_month).length}</strong>
        </div>
        <div className="summary-tile">
          <span className="summary-list-label">Export</span>
          <button className="button button-secondary" type="button" onClick={() => api.exportBillsCsv(month)}>
            Download CSV
          </button>
        </div>
      </div>

      <form className="sheet-entry-form" onSubmit={handleSubmit}>
        <div className="sheet-entry-grid sheet-entry-grid-bills">
          <div className="field">
            <label htmlFor="bill-name">Fixed Expense</label>
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
            <div className="action-group action-group-compact">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Fixed Expense"}
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
            <label htmlFor="bill-search">Search Fixed Expenses</label>
            <input
              id="bill-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search fixed expense name"
            />
          </div>

          <div className="field">
            <label htmlFor="bill-status-filter">Status</label>
            <select
              id="bill-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div className="sheet-entry-actions">
            <button className="button button-secondary" type="button" onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
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
              <th>Fixed Expense</th>
              <th>Due Date</th>
              <th>Paid Date</th>
              <th>Payment Note</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th className="actions-column">Payment</th>
              <th className="actions-column">Manage</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.map((bill, index) => {
              const draft = paymentDrafts[bill.id] || { paid_date: "", note: "" };
              return (
                <tr key={bill.id}>
                  <td className="row-number-column">{index + 1}</td>
                  <td className="budget-table-category">{bill.name}</td>
                  <td>{bill.due_date_for_month || `Day ${bill.due_day}`}</td>
                  <td>
                    <input
                      className="inline-row-input"
                      type="date"
                      value={draft.paid_date}
                      onChange={(event) =>
                        setPaymentDrafts((current) => ({
                          ...current,
                          [bill.id]: { ...current[bill.id], paid_date: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="inline-row-input"
                      value={draft.note}
                      onChange={(event) =>
                        setPaymentDrafts((current) => ({
                          ...current,
                          [bill.id]: { ...current[bill.id], note: event.target.value },
                        }))
                      }
                      placeholder="Optional note"
                    />
                  </td>
                  <td>
                    <span className={`table-pill ${bill.is_paid_for_month ? "paid" : "unpaid"}`}>
                      {bill.is_paid_for_month ? "Paid" : "Unpaid"}
                    </span>
                  </td>
                  <td>{formatMoney(bill.amount)}</td>
                  <td>
                    {bill.payment_has_receipt ? (
                      <div className="action-group">
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() =>
                            api.downloadBillPaymentReceipt(
                              bill.id,
                              month,
                              bill.payment_receipt_name || `${bill.name}.jpg`,
                            )
                          }
                        >
                          View
                        </button>
                        <button
                          className="table-action-button table-action-button-danger"
                          type="button"
                          onClick={() => onDeleteReceipt(bill.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          className="table-action-button"
                          type="button"
                          onClick={() => fileInputRefs.current[bill.id]?.click()}
                          disabled={!bill.is_paid_for_month}
                        >
                          Upload
                        </button>
                        <input
                          ref={(node) => {
                            fileInputRefs.current[bill.id] = node;
                          }}
                          className="hidden-file-input"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(event) => handleUploadReceipt(bill, event)}
                        />
                      </>
                    )}
                  </td>
                  <td className="actions-column">
                    <div className="action-group">
                      <button
                        className="table-action-button"
                        type="button"
                        onClick={() => handleSetPaidDate(bill)}
                        disabled={submitting}
                      >
                        {bill.is_paid_for_month ? "Update Paid" : "Mark Paid"}
                      </button>
                      {bill.is_paid_for_month ? (
                        <button
                          className="table-action-button table-action-button-danger"
                          type="button"
                          onClick={() => handleClearPaidDate(bill)}
                          disabled={submitting}
                        >
                          Clear Paid
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="actions-column">
                    <div className="action-group">
                      <button className="table-action-button" type="button" onClick={() => startEdit(bill)}>
                        Edit
                      </button>
                      <button
                        className="table-action-button table-action-button-danger"
                        type="button"
                        onClick={() => handleDelete(bill)}
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
    </section>
  );
}
