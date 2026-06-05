import { useEffect, useSyncExternalStore } from "react";
import type { User } from "@/types";
import * as api from "@/lib/api";

type AuthState = {
  user: User | null;
  loading: boolean;
};

let state: AuthState = { user: null, loading: true };
const listeners = new Set<() => void>();

function setState(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

let bootstrapped = false;
export async function bootstrapAuth() {
  if (bootstrapped) return;
  bootstrapped = true;
  if (typeof window === "undefined") return;
  const token = api.apiInternals.getToken();
  if (!token) {
    setState({ user: null, loading: false });
    return;
  }
  try {
    const u = await api.getCurrentUser();
    setState({ user: u, loading: false });
  } catch {
    api.apiInternals.setToken(null);
    setState({ user: null, loading: false });
  }
}

export function useAuth() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    bootstrapAuth();
  }, []);
  return s;
}

// Обновить данные текущего пользователя в состоянии (например, после смены email).
export function applyUser(user: User) {
  setState({ user, loading: false });
}

export async function loginUser(email: string, password: string) {
  const { user } = await api.login(email, password);
  setState({ user, loading: false });
  return user;
}

export async function logoutUser() {
  await api.logout();
  setState({ user: null, loading: false });
}
