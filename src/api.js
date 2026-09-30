const BASE = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:5000/api";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let token = null;
export const setToken = (t) => { token = t; };

// Core request helper. Every call goes through here so auth headers, JSON
// parsing and error shape stay consistent across the whole app.
async function request(path, { method = "GET", body, isBlob = false, isForm = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 204) return null;

  if (isBlob) {
    if (!res.ok) throw new ApiError(res.status, "ERROR", "Export failed.");
    return res.blob();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error || {};
    throw new ApiError(res.status, err.code || "ERROR", err.message || "Something went wrong.");
  }
  return data;
}

export const api = {
  // auth
  register: (body) => request("/auth/register", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  me: () => request("/auth/me"),
  updateMe: (body) => request("/auth/me", { method: "PATCH", body }),
  setReminder: (body) => request("/auth/me/reminder", { method: "PUT", body }),

  // habits
  listHabits: () => request("/habits"),
  createHabit: (body) => request("/habits", { method: "POST", body }),
  updateHabit: (id, body) => request(`/habits/${id}`, { method: "PATCH", body }),
  deleteHabit: (id) => request(`/habits/${id}`, { method: "DELETE" }),

  // check-ins
  checkIn: (habitId) => request(`/habits/${habitId}/checkins`, { method: "POST" }),
  undoCheckIn: (habitId) => request(`/habits/${habitId}/checkins/today`, { method: "DELETE" }),

  // stats
  summary: () => request("/stats/summary"),
  dailyRate: (days = 30) => request(`/stats/daily-rate?days=${days}`),
  heatmap: () => request("/stats/heatmap"),
  exportCsv: () => request("/stats/export.csv", { isBlob: true }),

  // badges / friends / billing
  badges: () => request("/badges"),
  leaderboard: () => request("/friends/leaderboard"),
  upgrade: () => request("/billing/upgrade", { method: "POST" }),
  downgrade: () => request("/billing/downgrade", { method: "POST" }),
};
