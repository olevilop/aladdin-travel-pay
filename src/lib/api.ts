import type {
  Application,
  CompanyType,
  InvoiceFile,
  LoginResponse,
  Role,
  User,
} from "@/types";
import {
  db,
  findApplication,
  findFile,
  mockCurrentUser,
  mockFiles,
  nowISO,
  uid,
} from "@/lib/mock/store";
import { formatDate } from "@/lib/format";

/**
 * API_URL — пустая строка = мок-режим (in-memory).
 * Если задана — все методы будут дёргать реальный backend.
 */
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "";

const TOKEN_KEY = "att_token";
const MOCK_TOKEN = "mock-token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ─── REAL request helper ──────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data.message || msg;
    } catch {}
    throw new Error(msg || "Request failed");
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────
export async function login(email: string, _password: string): Promise<LoginResponse> {
  if (!API_URL) {
    await delay();
    const user = mockCurrentUser();
    setToken(MOCK_TOKEN);
    return { token: MOCK_TOKEN, user: { ...user, email: email || user.email } };
  }
  const data = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: _password }),
  });
  setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  if (!API_URL) {
    await delay(100);
    setToken(null);
    return;
  }
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}

export async function getCurrentUser(): Promise<User> {
  if (!API_URL) {
    await delay(100);
    if (!getToken()) throw new Error("Не авторизован");
    return mockCurrentUser();
  }
  return request<User>("/auth/me");
}

// ─── APPLICATIONS ─────────────────────────────────────────────────────────
export async function listApplications(query?: string): Promise<Application[]> {
  if (!API_URL) {
    await delay();
    const q = (query || "").toLowerCase().trim();
    const list = [...db.applications].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    );
    if (!q) return list;
    return list.filter(
      (a) =>
        a.number.toLowerCase().includes(q) || a.title.toLowerCase().includes(q),
    );
  }
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return request<Application[]>(`/applications${qs}`);
}

export async function createApplication(
  title: string,
  description: string,
): Promise<Application> {
  if (!API_URL) {
    await delay();
    const me = mockCurrentUser();
    const app: Application = {
      id: uid(),
      number: newAppNumber(),
      title,
      description,
      created_at: nowISO(),
      created_by: me.id,
      files: [],
    };
    db.applications.unshift(app);
    return app;
  }
  return request<Application>("/applications", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export async function getApplication(id: string): Promise<Application> {
  if (!API_URL) {
    await delay();
    const app = findApplication(id);
    if (!app) throw new Error("Заявка не найдена");
    return app;
  }
  return request<Application>(`/applications/${id}`);
}

export async function deleteApplication(id: string): Promise<void> {
  if (!API_URL) {
    await delay();
    const idx = db.applications.findIndex((a) => a.id === id);
    if (idx >= 0) {
      const app = db.applications[idx];
      for (const f of app.files) mockFiles.delete(f.id);
      db.applications.splice(idx, 1);
    }
    return;
  }
  await request(`/applications/${id}`, { method: "DELETE" });
}

// ─── FILES ────────────────────────────────────────────────────────────────
export async function uploadFile(
  applicationId: string,
  companyType: CompanyType,
  file: File,
): Promise<InvoiceFile> {
  if (!API_URL) {
    await delay();
    const app = findApplication(applicationId);
    if (!app) throw new Error("Заявка не найдена");
    const me = mockCurrentUser();
    const inv: InvoiceFile = {
      id: uid(),
      application_id: applicationId,
      company_type: companyType,
      name: file.name,
      size: file.size,
      mime: file.type,
      uploaded_by: me.id,
      uploaded_by_name: me.full_name,
      uploaded_at: nowISO(),
      is_paid: false,
    };
    mockFiles.put(inv.id, file);
    app.files.push(inv);
    return inv;
  }
  const fd = new FormData();
  fd.append("company_type", companyType);
  fd.append("file", file);
  return request<InvoiceFile>(`/applications/${applicationId}/files`, {
    method: "POST",
    body: fd,
  });
}

export async function downloadFile(fileId: string): Promise<Blob> {
  if (!API_URL) {
    await delay(100);
    const file = mockFiles.get(fileId);
    if (file) return file;
    // Seed-файл — отдадим плейсхолдер
    const found = findFile(fileId);
    const name = found?.file.name || "file";
    return new Blob([`Демо-файл: ${name}`], { type: "text/plain" });
  }
  const token = getToken();
  const res = await fetch(`${API_URL}/files/${fileId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Не удалось скачать файл");
  return res.blob();
}

export async function toggleFilePaid(fileId: string): Promise<InvoiceFile> {
  if (!API_URL) {
    await delay();
    const found = findFile(fileId);
    if (!found) throw new Error("Файл не найден");
    found.file.is_paid = !found.file.is_paid;
    return found.file;
  }
  return request<InvoiceFile>(`/files/${fileId}/toggle-paid`, { method: "POST" });
}

export async function deleteFile(fileId: string): Promise<void> {
  if (!API_URL) {
    await delay();
    const found = findFile(fileId);
    if (!found) return;
    found.app.files = found.app.files.filter((f) => f.id !== fileId);
    mockFiles.delete(fileId);
    return;
  }
  await request(`/files/${fileId}`, { method: "DELETE" });
}

// ─── USERS / ADMIN ────────────────────────────────────────────────────────
export async function listUsers(): Promise<User[]> {
  if (!API_URL) {
    await delay();
    return [...db.users];
  }
  return request<User[]>("/users");
}

export async function createUser(
  email: string,
  fullName: string,
  role: Role,
  tempPassword: string,
): Promise<User> {
  if (!API_URL) {
    await delay();
    const u: User = {
      id: uid(),
      email,
      full_name: fullName,
      role,
      is_active: true,
      created_at: nowISO(),
    };
    db.users.push(u);
    return u;
  }
  return request<User>("/users", {
    method: "POST",
    body: JSON.stringify({ email, full_name: fullName, role, temp_password: tempPassword }),
  });
}

export async function updateUserRole(userId: string, role: Role): Promise<User> {
  if (!API_URL) {
    await delay();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error("Пользователь не найден");
    u.role = role;
    return u;
  }
  return request<User>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function toggleUserActive(userId: string): Promise<User> {
  if (!API_URL) {
    await delay();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error("Пользователь не найден");
    u.is_active = !u.is_active;
    return u;
  }
  return request<User>(`/users/${userId}/toggle-active`, { method: "POST" });
}

export const apiInternals = { getToken, setToken, API_URL };
