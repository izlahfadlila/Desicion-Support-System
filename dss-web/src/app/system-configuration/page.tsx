"use client";

import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import type { SystemState, ProductKey, PurchaseOrder, Transaction } from "@/lib/types";
import {
  loadState,
  resetState,
  simulateNextDay,
  getOnOrderQty,
  getPendingOrders,
  formatDate,
  formatDateLong,
} from "@/lib/store";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/constants";
import { SEPTEMBER_ACTUAL_SALES } from "@/data/septemberActuals";

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SALES: { label: "Sales", color: "text-blue-700 bg-blue-50" },
  GOODS_RECEIPT: { label: "Goods Receipt", color: "text-green-700 bg-green-50" },
  NEW_PO: { label: "Purchase Order", color: "text-indigo-700 bg-indigo-50" },
  ORDER_PLACED: { label: "Auto PO", color: "text-purple-700 bg-purple-50" },
  ADJUSTMENT: { label: "Adjustment", color: "text-gray-700 bg-gray-50" },
  STOCKOUT: { label: "Stockout", color: "text-red-700 bg-red-50" },
  INITIAL_SETUP: { label: "Initialization", color: "text-gray-600 bg-gray-100" },
};

export default function SystemConfigurationPage() {
  const [state, setState] = useState<SystemState | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSimResult, setShowSimResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"daily" | "setup" | "transactions" | "config">("daily");
  const [logFilter, setLogFilter] = useState<"all" | "eval" | "demo">("all");

  const refresh = useCallback(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("dss_state_changed", refresh);
    return () => window.removeEventListener("dss_state_changed", refresh);
  }, [refresh]);

  if (!state) return <AppLayout><div className="p-8 text-gray-500">Loading...</div></AppLayout>;

  const actualSalesToday = SEPTEMBER_ACTUAL_SALES[state.currentDate] ?? {
    golf_polo: 0,
    running_shoe: 0,
    life_vest: 0,
  };

  // ---- Automated Advance Day ----
  const handleSimulate = () => {
    const prevState = { ...state };
    const newState = simulateNextDay(state);
    setState(newState);
    window.dispatchEvent(new Event("dss_state_changed"));

    const lines = PRODUCTS.map((p) => {
      const sold = actualSalesToday[p.key] ?? 0;
      const stock = newState.inventory[p.key].currentStock;
      return `${p.shortName}: sold ${sold} → stock ${stock}`;
    });
    setShowSimResult(`Advanced from ${prevState.currentDate} to ${newState.currentDate}. ${lines.join(" · ")}`);
  };

  // ---- Reset to Sep 26 Demo State ----
  const handleReset = () => {
    const fresh = resetState();
    setState(fresh);
    window.dispatchEvent(new Event("dss_state_changed"));
    setShowResetConfirm(false);
    setShowSimResult("System reset cleanly to Sep 26, 2026 demo state (continuing from Sep 1–25 evaluation).");
  };

  const pendingOrders = getPendingOrders(state);
  const allTransactions = [...state.transactions].reverse();

  // Filter transactions
  const filteredTransactions = allTransactions.filter((tx) => {
    if (logFilter === "eval") return tx.date < "2026-09-26";
    if (logFilter === "demo") return tx.date >= "2026-09-26";
    return true;
  });

  const onOrderSummary = PRODUCTS.map((p) => ({
    p,
    onOrder: getOnOrderQty(state, p.key),
    stock: state.inventory[p.key].currentStock,
  }));

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
            <p className="text-sm text-gray-500 mt-1">
              Automated daily simulation, baseline setup status, and audit trail transaction log
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2">
              <span>System Date: <strong>{formatDateLong(state.currentDate)}</strong></span>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 btn-danger text-sm"
            >
              Reset to Sep 26 Demo State
            </button>
          </div>
        </div>

        {/* Result Banner */}
        {showSimResult && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <span className="text-sm text-green-800">{showSimResult}</span>
            <button onClick={() => setShowSimResult(null)} className="ml-auto text-green-400 hover:text-green-600">
              Dismiss
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: "daily", label: "Daily Simulation" },
            { id: "setup", label: "Initialization Baseline" },
            { id: "transactions", label: `Transaction Log (${allTransactions.length})` },
            { id: "config", label: "System Status" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Daily Simulation */}
        {activeTab === "daily" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Simulation Card */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-gray-900">Advance to Next Day (Automated)</h2>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-800 space-y-1">
                <div><strong>Automated Trace-driven Simulation:</strong></div>
                <div>1. Fulfills customer demand from real dataset records for <strong>{state.currentDate}</strong>.</div>
                <div>2. End-of-Day (EOD) receipt: any PO scheduled on or before {state.currentDate} is received and becomes available for sales on the next day.</div>
                <div>3. Advances the system date automatically.</div>
              </div>

              {/* Today's Actual Demand from Dataset */}
              <div className="space-y-3 mb-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actual Demand for {state.currentDate} (from Dataset Records):
                </div>
                {PRODUCTS.map((p) => {
                  const actual = actualSalesToday[p.key] ?? 0;
                  const currentStock = state.inventory[p.key].currentStock;
                  return (
                    <div key={p.key} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.shortName}</div>
                        <div className="text-xs text-gray-400">Current Stock: {currentStock} units</div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-blue-700">{actual}</span>
                        <span className="text-xs text-gray-500 ml-1">units to sell</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleSimulate}
                disabled={state.currentDate >= "2026-09-30"}
                className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors ${
                  state.currentDate >= "2026-09-30"
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "btn-primary"
                }`}
              >
                {state.currentDate >= "2026-09-30"
                  ? "Reached End of Dataset (30 Sep 2026)"
                  : `Advance to Next Day (${state.currentDate} → next)`}
              </button>
            </div>

            {/* Current Inventory & Pending Orders */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-gray-900">Current Inventory &amp; Pipeline</h2>
              </div>
              <div className="space-y-3">
                {onOrderSummary.map(({ p, onOrder, stock }) => (
                  <div key={p.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{p.shortName}</div>
                      <div className="text-xs text-gray-500">{p.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{stock} <span className="text-xs text-gray-400">in stock</span></div>
                      <div className="text-xs text-indigo-600">+{onOrder} on order</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Incoming POs */}
              <div className="mt-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Active Incoming Orders ({pendingOrders.length})
                </div>
                {pendingOrders.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-xs text-gray-400 text-center">
                    No pending orders in transit
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingOrders
                      .sort((a, b) => a.expectedArrival.localeCompare(b.expectedArrival))
                      .map((po) => {
                        const isToday = po.expectedArrival === state.currentDate;
                        const isArrivedPast = po.expectedArrival < state.currentDate;
                        return (
                          <div
                            key={po.orderId}
                            className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                              isToday
                                ? "bg-green-50 border border-green-200"
                                : isArrivedPast
                                ? "bg-amber-50"
                                : "bg-gray-50"
                            }`}
                          >
                            <span className="font-mono text-gray-500">{po.orderId}</span>
                            <span className="font-medium">{PRODUCT_MAP[po.productKey]?.shortName}</span>
                            <span className="font-bold">{po.quantity}u</span>
                            <span className={`ml-auto font-medium ${isToday ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                              {isToday ? "Arrives TODAY (EOD)" : `Expected: ${formatDate(po.expectedArrival)}`}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Initialization Baseline (Read-Only) */}
        {activeTab === "setup" && (
          <div className="card p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">System Initialization Baseline (1 Sep 2026)</h2>
              <p className="text-xs text-gray-500 mt-1">
                The continuous simulation initialized on September 1, 2026 with calibrated stocks and prior August POs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-semibold text-gray-400 uppercase">Golf Polo Baseline</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">80 units</div>
                <div className="text-xs text-gray-500 mt-1">+30u PO-AUG-001 (arrived 3 Sep)</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-semibold text-gray-400 uppercase">Running Shoe Baseline</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">45 units</div>
                <div className="text-xs text-gray-500 mt-1">0u in-transit on 1 Sep</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="text-xs font-semibold text-gray-400 uppercase">Life Vest Baseline</div>
                <div className="text-2xl font-bold text-gray-900 mt-1">100 units</div>
                <div className="text-xs text-gray-500 mt-1">+40u PO-AUG-002 (arrived 4 Sep)</div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800 space-y-1">
              <strong>Continuous Supply Chain Pipeline:</strong>
              <div>Between Sep 1 and Sep 25, 2026, the DSS automated simulation placed 42 replenishment orders based on ML rolling forecasts, naturally bringing inventory to the starting demo state on Sep 26, 2026.</div>
            </div>
          </div>
        )}

        {/* Tab 3: Transaction Log with Filter */}
        {activeTab === "transactions" && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-gray-900">Audit Trail Transaction Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">Immutable audit record of all replenishment decisions and inventory movements</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Filter Period:</span>
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
                >
                  <option value="all">All Events ({allTransactions.length})</option>
                  <option value="eval">Evaluation Period (1–25 Sep)</option>
                  <option value="demo">Live Demo Period (26–30 Sep)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b border-gray-200">
                  <tr className="text-gray-500">
                    <th className="text-left pb-2 font-medium">Date</th>
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-left pb-2 font-medium">Product</th>
                    <th className="text-right pb-2 font-medium">Qty</th>
                    <th className="text-left pb-2 font-medium pl-3">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const cfg = TX_TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-gray-600 bg-gray-100" };
                    return (
                      <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-mono text-gray-600">{tx.date}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-2 font-medium">{PRODUCT_MAP[tx.productKey]?.shortName ?? tx.productKey}</td>
                        <td className="py-2 text-right font-mono font-semibold">{tx.quantity > 0 ? tx.quantity : "—"}</td>
                        <td className="py-2 pl-3 text-gray-600">{tx.description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: System Status */}
        {activeTab === "config" && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">System Architecture &amp; Storage Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="font-semibold text-gray-700">Storage Layer: Upstash Redis (Cloud KV)</div>
                <div className="text-gray-500">Connected via REST API endpoint: <code>/api/state</code> with automatic LocalStorage fallback.</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="font-semibold text-gray-700">Simulation Engine: Trace-driven EOD</div>
                <div className="text-gray-500">Deterministic trace simulation over September 2026 data. End-of-Day receipt applied.</div>
              </div>
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Reset System to Sep 26 Demo State?</h3>
              <p className="text-sm text-gray-600">
                This will reset the system date back to <strong>September 26, 2026</strong> and restore the calibrated inventory stocks and pending orders.
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setShowResetConfirm(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
                <button onClick={handleReset} className="btn-danger text-sm">
                  Yes, Reset State
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
