"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PackageCheck,
  BarChart3,
  Settings,
  Menu,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { getSession, logout, homeForRole, isAdminPath } from "@/lib/auth";

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
  const [username, setUsername] = useState("");
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentDate, setCurrentDate] = useState("2026-10-01");
  const pathname = usePathname();
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const adminPage = isAdminPath(pathname);
    if ((adminPage && session.role !== "admin") || (!adminPage && session.role === "admin")) {
      router.replace(homeForRole(session.role));
      return;
    }
    setRole(session.role);
    setUsername(session.username);
    setReady(true);
  }, [pathname, router]);

  useEffect(() => {
    // Sidebar closed by default on small screens
    if (window.innerWidth < 1024) setSidebarOpen(false);

    const readDate = () => {
      try {
        const state = JSON.parse(localStorage.getItem("dss_inventory_state_v2") || "{}");
        if (state.currentDate) setCurrentDate(state.currentDate);
      } catch {}
    };
    readDate();
    window.addEventListener("storage", readDate);
    window.addEventListener("dss_state_changed", readDate);
    return () => {
      window.removeEventListener("storage", readDate);
      window.removeEventListener("dss_state_changed", readDate);
    };
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const navItems = role === "user" ? USER_NAV : ADMIN_NAV;

  const formatDisplayDate = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  };

  if (!ready) return <div className="h-screen bg-gray-50" />;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 text-white overflow-hidden
          transition-all duration-300
          ${sidebarOpen ? "translate-x-0 lg:w-64" : "-translate-x-full lg:translate-x-0 lg:w-0"}
          lg:relative
        `}
      >
        <div className="w-64 h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-800">
            <div>
              <div className="text-sm font-bold leading-tight">DSS Inventory</div>
              <div className="text-xs text-blue-100 leading-tight">Replenishment System</div>
            </div>
            <button
              className="ml-auto text-blue-100 hover:text-white"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <Menu size={22} />
            </button>
          </div>

          {/* Role Badge */}
          <div className="px-6 py-3 border-b border-navy-800">
            <div className="text-xs text-blue-100 uppercase tracking-wider mb-1">Current Role</div>
            <div className="text-sm font-semibold text-white">
              {role === "admin" ? "Admin" : "User (Manager)"}
            </div>
            <div className="text-xs text-blue-100">{username}</div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            <div className="text-xs font-semibold text-blue-100 uppercase tracking-wider px-2 mb-2">
              {role === "user" ? "User Menu" : "Admin Menu"}
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${active ? "bg-white text-blue-600" : "text-white hover:bg-navy-800"}
                  `}
                >
                  <Icon size={18} />
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* System Date + Logout */}
          <div className="px-6 py-4 border-t border-navy-800">
            <div className="text-xs text-blue-100 mb-1">System Date</div>
            <div className="text-xs font-mono text-white">{formatDisplayDate(currentDate)}</div>
            <div className="text-xs text-blue-100 mt-1">Data through Sep 30, 2026</div>
            <button
              onClick={handleLogout}
              className="mt-3 w-full text-sm font-medium bg-white text-blue-600 hover:bg-blue-100 rounded-lg py-2 transition-colors"
            >
              Logout
            </button>
          </div>
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
          {!sidebarOpen && (
            <button
              className="text-gray-500 hover:text-gray-900"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={22} />
            </button>
          )}

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden sm:flex items-center text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              {formatDisplayDate(currentDate)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
