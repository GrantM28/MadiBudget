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

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function request(path, options = {}) {
  const headers = {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {}),
  };

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";

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

  if (!contentType.toLowerCase().includes("application/json")) {
    const body = await response.text();
    const looksLikeHtml = /^\s*</.test(body);
    if (looksLikeHtml) {
      throw new Error(
        "The request hit the frontend instead of the backend API. Check VITE_API_URL or your reverse proxy routing.",
      );
    }

    throw new Error("The server returned an unexpected response instead of JSON.");
  }

  return response.json();
}

async function uploadFile(path, file) {
  const formData = new FormData();
  formData.append("receipt", file);
  return request(path, {
    method: "POST",
    body: formData,
  });
}

async function downloadFile(path, filename) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });

  if (!response.ok) {
    const error = new Error("Unable to download file.");
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
  changePassword: (payload) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logoutAllSessions: () =>
    request("/auth/logout-all", {
      method: "POST",
    }),
  getUsers: () => request("/users"),
  createUser: (payload) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteUser: (id) =>
    request(`/users/${id}`, {
      method: "DELETE",
    }),
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
  uploadBillPaymentReceipt: (id, month, file) =>
    uploadFile(`/bills/${id}/payment/receipt${buildQuery({ month })}`, file),
  deleteBillPaymentReceipt: (id, month) =>
    request(`/bills/${id}/payment/receipt${buildQuery({ month })}`, {
      method: "DELETE",
    }),
  downloadBillPaymentReceipt: (id, month, filename = "fixed-expense-receipt") =>
    downloadFile(`/bills/${id}/payment/receipt${buildQuery({ month })}`, filename),
  exportBillsCsv: (month) =>
    downloadFile(`/bills/export${buildQuery({ month })}`, `madibudget-fixed-expenses-${month}.csv`),
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
  exportCategoriesCsv: (month) =>
    downloadFile(`/categories/export${buildQuery({ month })}`, `madibudget-categories-${month}.csv`),
  getMerchantRules: () => request("/merchant-rules"),
  createMerchantRule: (payload) =>
    request("/merchant-rules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateMerchantRule: (id, payload) =>
    request(`/merchant-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteMerchantRule: (id) =>
    request(`/merchant-rules/${id}`, {
      method: "DELETE",
    }),
  getTransactions: (filters = {}) => request(`/transactions${buildQuery(filters)}`),
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
  uploadTransactionReceipt: (id, file) => uploadFile(`/transactions/${id}/receipt`, file),
  deleteTransactionReceipt: (id) =>
    request(`/transactions/${id}/receipt`, {
      method: "DELETE",
    }),
  downloadTransactionReceipt: (id, filename = "transaction-receipt") =>
    downloadFile(`/transactions/${id}/receipt`, filename),
  exportTransactionsCsv: (filters = {}, month = "current") =>
    downloadFile(
      `/transactions/export${buildQuery(filters)}`,
      `madibudget-transactions-${month}.csv`,
    ),
};
