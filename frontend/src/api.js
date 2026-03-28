const runtimeApiBase =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://localhost:8000";

const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || runtimeApiBase;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Request failed.";

    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  getDashboard: (month) => request(`/dashboard?month=${encodeURIComponent(month)}`),
  getPlan: (month) => request(`/plan?month=${encodeURIComponent(month)}`),
  getIncomes: () => request("/incomes"),
  createIncome: (payload) =>
    request("/incomes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateIncome: (id, payload) =>
    request(`/incomes/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteIncome: (id) =>
    request(`/incomes/${id}`, {
      method: "DELETE",
    }),
  getIncomeAdjustments: (month) =>
    request(`/income-adjustments?month=${encodeURIComponent(month)}`),
  createIncomeAdjustment: (payload) =>
    request("/income-adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateIncomeAdjustment: (id, payload) =>
    request(`/income-adjustments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteIncomeAdjustment: (id) =>
    request(`/income-adjustments/${id}`, {
      method: "DELETE",
    }),
  getBills: () => request("/bills"),
  createBill: (payload) =>
    request("/bills", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateBill: (id, payload) =>
    request(`/bills/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteBill: (id) =>
    request(`/bills/${id}`, {
      method: "DELETE",
    }),
  getCategories: () => request("/categories"),
  createCategory: (payload) =>
    request("/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (id, payload) =>
    request(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCategory: (id) =>
    request(`/categories/${id}`, {
      method: "DELETE",
    }),
  getTransactions: (month) => request(`/transactions?month=${encodeURIComponent(month)}`),
  createTransaction: (payload) =>
    request("/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTransaction: (id, payload) =>
    request(`/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteTransaction: (id) =>
    request(`/transactions/${id}`, {
      method: "DELETE",
    }),
};
