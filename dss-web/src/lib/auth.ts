// ============================================================
// Simple role-based login (demo, client-side only)
// ============================================================

import type { Role } from "./types";

export const AUTH_KEY = "dss_auth";

export const CREDENTIALS: Record<Role, { username: string; password: string }> = {
  user: { username: "user", password: "user123" },
  admin: { username: "admin", password: "admin123" },
};

export interface AuthSession {
  role: Role;
  username: string;
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    if (s && (s.role === "user" || s.role === "admin")) return s;
  } catch {
    // ignore
  }
  return null;
}

export function login(role: Role, username: string, password: string): boolean {
  const cred = CREDENTIALS[role];
  if (username.trim() !== cred.username || password !== cred.password) return false;
  localStorage.setItem(AUTH_KEY, JSON.stringify({ role, username: cred.username }));
  localStorage.setItem("dss_role", role);
  return true;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem("dss_role");
}

export function homeForRole(role: Role): string {
  return role === "admin" ? "/forecasting-management" : "/dashboard";
}

const ADMIN_PATHS = ["/forecasting-management", "/system-configuration"];
export function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname.startsWith(p));
}
