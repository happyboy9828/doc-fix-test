const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  (typeof window !== "undefined" && window.__DOCFIX_API_BASE__) ||
  "/api/v1";

async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "include",
    ...options,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const error = new Error((data && data.message) || `Request failed: ${res.status}`);
    error.status = res.status;
    error.body = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) =>
    request(path, { method: "POST", body: JSON.stringify(body), ...options }),
  patch: (path, body, options) =>
    request(path, { method: "PATCH", body: JSON.stringify(body), ...options }),
  delete: (path, options) => request(path, { method: "DELETE", ...options }),
};

export default api;