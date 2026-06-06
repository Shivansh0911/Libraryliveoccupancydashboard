const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function checkOk(r: Response) {
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `HTTP ${r.status}`);
  }
  return r.json();
}

export const getLatestCounts = () =>
  fetch(`${BASE}/count/latest`).then(checkOk);

export const getRegions = () =>
  fetch(`${BASE}/regions`).then(checkOk);

export const createRegion = (data: object, tok: string) =>
  fetch(`${BASE}/regions`, {
    method: "POST",
    headers: authHeaders(tok),
    body: JSON.stringify(data),
  }).then(checkOk);

export const updateRegion = (id: number, data: object, tok: string) =>
  fetch(`${BASE}/regions/${id}`, {
    method: "PUT",
    headers: authHeaders(tok),
    body: JSON.stringify(data),
  }).then(checkOk);

export const deleteRegion = (id: number, tok: string) =>
  fetch(`${BASE}/regions/${id}`, {
    method: "DELETE",
    headers: authHeaders(tok),
  }).then(checkOk);

export const login = (username: string, password: string) =>
  fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then(checkOk);
