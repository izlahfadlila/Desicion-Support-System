"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { login, getSession, homeForRole, CREDENTIALS } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const s = getSession();
    if (s) router.replace(homeForRole(s.role));
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(role, username, password)) {
      router.replace(homeForRole(role));
    } else {
      setError("Invalid username or password for the selected role.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-navy-900 text-white px-8 py-6">
          <div className="text-xl font-bold">DSS Inventory</div>
          <div className="text-sm text-blue-100">Replenishment System</div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="label">Login as</label>
            <div className="grid grid-cols-2 gap-2">
              {(["user", "admin"] as Role[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setError("");
                  }}
                  className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                    role === r
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {r === "user" ? "User" : "Admin"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Username</label>
            <input
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" className="w-full btn-primary">
            Login
          </button>

          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            Demo accounts — User: <span className="font-mono">{CREDENTIALS.user.username} / {CREDENTIALS.user.password}</span>
            {" · "}Admin: <span className="font-mono">{CREDENTIALS.admin.username} / {CREDENTIALS.admin.password}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
