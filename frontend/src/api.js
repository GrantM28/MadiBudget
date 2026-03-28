function isDirectBackendHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

const runtimeApiBase =
  typeof window !== "undefined"
    ? isDirectBackendHost(window.location.hostname)
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : window.location.origin
    : "http://localhost:8000";

const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || runtimeApiBase;
const AUTH_TOKEN_KEY = "madibudget_auth_token";

let authToken =
  typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_KEY) || "" : "";

function setAuthToken(token) {
  authToken = token || "";
  if (typeof window !== "undefined") {
    if (authToken) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }
}

function clearAuthToken() {
  setAuthToken("");
}

function hasAuthToken() {
  return Boolean(authToken);
}

function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("madibudget:auth-expired"));
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Request failed.";

    if (response.status === 401) {
      clearAuthToken();
      notifyAuthExpired();
    }

    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      message = response.statusText || message;
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  hasAuthToken,
  setAuthToken,
  clearAuthToken,
  getAuthStatus: () => request("/auth/status"),
  setupFirstUser: (payload) =>
    request("/auth/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMe: () => request("/auth/me"),
  getDashboard: (month) => request(`/dashboard?month=${encodeURIComponent(month)}`),
  getPlan: (month) => request(`/plan?month=${encodeURIComponent(month)}`),
  getCashPosition: () => request("/cash-position"),
  updateCashPosition: (payload) =>
    request("/cash-position", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
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
  getBills: (month) => request(`/bills?month=${encodeURIComponent(month)}`),
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
  setBillPayment: (id, payload) =>
    request(`/bills/${id}/payment`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  clearBillPayment: (id, month) =>
    request(`/bills/${id}/payment?month=${encodeURIComponent(month)}`, {
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
