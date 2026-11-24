"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PackageCheck,
  BarChart3,
  Settings,
  TrendingUp,
  ChevronDown,
  Menu,
  X,
  Box,
} from "lucide-react";
import type { Role } from "@/lib/types";

const USER_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inventory Decision", href: "/inventory-decision", icon: PackageCheck },
];

const ADMIN_NAV = [
  { label: "Forecasting Management", href: "/forecasting-management", icon: BarChart3 },
  { label: "System Configuration", href: "/system-configuration", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [role, setRole] = useState<Role>("user");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("2026-10-01");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Load role and date from localStorage
    const savedRole = localStorage.getItem("dss_role") as Role | null;
    if (savedRole) setRole(savedRole);
    try {
      const state = JSON.parse(localStorage.getItem("dss_inventory_state_v2") || "{}");
      if (state.currentDate) setCurrentDate(state.currentDate);
    } catch {}

    // Listen for state changes
    const handler = () => {
      try {
        const state = JSON.parse(localStorage.getItem("dss_inventory_state_v2") || "{}");
        if (state.currentDate) setCurrentDate(state.currentDate);
      } catch {}
    };
    window.addEventListener("storage", handler);
    window.addEventListener("dss_state_changed", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("dss_state_changed", handler);
    };
  }, []);

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    localStorage.setItem("dss_role", newRole);
    setSidebarOpen(false);
    if (newRole === "user") router.push("/dashboard");
    else router.push("/forecasting-management");
  };

  const navItems = role === "user" ? USER_NAV : ADMIN_NAV;

  const formatDisplayDate = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 text-white flex flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:relative lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-800">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Box size={18} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">DSS Inventory</div>
            <div className="text-xs text-blue-300 leading-tight">Replenishment System</div>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Role Badge */}
        <div className="px-6 py-3 border-b border-navy-800">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Role</div>
          <div className={`text-sm font-semibold ${role === "admin" ? "text-amber-400" : "text-blue-300"}`}>
            {role === "admin" ? "⚙ Admin" : "👤 User (Manager)"}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
            {role === "user" ? "User Menu" : "Admin Menu"}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-navy-800 hover:text-white"
                  }
                `}
              >
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* System Date */}
        <div className="px-6 py-4 border-t border-navy-800">
          <div className="text-xs text-gray-500 mb-1">System Date</div>
          <div className="text-xs font-mono text-blue-300">{formatDisplayDate(currentDate)}</div>
          <div className="text-xs text-gray-500 mt-1">Data through Sep 30, 2026</div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp size={16} className="text-blue-500" />
            <span>Intelligent Inventory Replenishment DSS</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* System date pill */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {formatDisplayDate(currentDate)}
            </div>

            {/* Role Switcher */}
            <div className="relative">
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => handleRoleChange("user")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  👤 User
                </button>
                <button
                  onClick={() => handleRoleChange("admin")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    role === "admin" ? "bg-amber-500 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  ⚙ Admin
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
