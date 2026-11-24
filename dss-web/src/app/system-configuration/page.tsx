"use client";

import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import type { SystemState, ProductKey, PurchaseOrder, Transaction, ProductInventory } from "@/lib/types";
import {
  loadState,
  saveState,
  resetState,
  simulateNextDay,
  getOnOrderQty,
  getPendingOrders,
  formatDate,
  formatDateLong,
} from "@/lib/store";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/constants";

type SalesInput = Record<ProductKey, string>;

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SALES: { label: "Sales", color: "text-blue-700 bg-blue-50" },
  GOODS_RECEIPT: { label: "Goods Receipt", color: "text-green-700 bg-green-50" },
  NEW_PO: { label: "Purchase Order", color: "text-indigo-700 bg-indigo-50" },
  ADJUSTMENT: { label: "Adjustment", color: "text-gray-700 bg-gray-50" },
  STOCKOUT: { label: "Stockout", color: "text-red-700 bg-red-50" },
};

export default function SystemConfigurationPage() {
  const [state, setState] = useState<SystemState | null>(null);
  const [salesInput, setSalesInput] = useState<SalesInput>({ golf_polo: "", running_shoe: "", life_vest: "" });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSimResult, setShowSimResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"daily" | "setup" | "transactions" | "config">("daily");

  // For initial setup editing
  const [editStock, setEditStock] = useState<Record<ProductKey, string>>({
    golf_polo: "50", running_shoe: "25", life_vest: "60",
  });
  const [editOrders, setEditOrders] = useState<PurchaseOrder[]>([]);
  const [setupSaved, setSetupSaved] = useState(false);

  const refresh = useCallback(() => {
    const s = loadState();
    setState(s);
    setEditStock({
      golf_polo: String(s.inventory.golf_polo.currentStock),
      running_shoe: String(s.inventory.running_shoe.currentStock),
      life_vest: String(s.inventory.life_vest.currentStock),
    });
    setEditOrders(s.purchaseOrders.filter((po) => po.status === "pending"));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("dss_state_changed", refresh);
    return () => window.removeEventListener("dss_state_changed", refresh);
  }, [refresh]);

  if (!state) return <AppLayout><div className="p-8 text-gray-500">Loading...</div></AppLayout>;

  // ---- Simulate Next Day ----
  const handleSimulate = () => {
    const sales: Record<ProductKey, number> = {
      golf_polo: Number(salesInput.golf_polo) || 0,
      running_shoe: Number(salesInput.running_shoe) || 0,
      life_vest: Number(salesInput.life_vest) || 0,
    };
    const newState = simulateNextDay(state, sales);
    setState(newState);
    window.dispatchEvent(new Event("dss_state_changed"));

    const lines: string[] = [];
    for (const p of PRODUCTS) {
      const sold = sales[p.key];
      const stock = newState.inventory[p.key].currentStock;
      lines.push(`${p.shortName}: sold ${sold} → stock now ${stock}`);
    }
    setShowSimResult(lines.join(" · "));
    setSalesInput({ golf_polo: "", running_shoe: "", life_vest: "" });
  };

  // ---- Reset ----
  const handleReset = () => {
    const fresh = resetState();
    setState(fresh);
    window.dispatchEvent(new Event("dss_state_changed"));
    setShowResetConfirm(false);
    setShowSimResult("System reset to initial state (Oct 1, 2026).");
  };

  // ---- Save Initial Setup ----
  const handleSaveSetup = () => {
    const inventory: Record<ProductKey, ProductInventory> = {
      golf_polo: { productKey: "golf_polo", currentStock: Number(editStock.golf_polo) || 0, backorders: 0 },
      running_shoe: { productKey: "running_shoe", currentStock: Number(editStock.running_shoe) || 0, backorders: 0 },
      life_vest: { productKey: "life_vest", currentStock: Number(editStock.life_vest) || 0, backorders: 0 },
    };
    const newState: SystemState = {
      ...state,
      inventory,
      purchaseOrders: [
        ...state.purchaseOrders.filter((po) => po.status === "arrived"),
        ...editOrders,
      ],
    };
    saveState(newState);
    setState(newState);
    window.dispatchEvent(new Event("dss_state_changed"));
    setSetupSaved(true);
    setTimeout(() => setSetupSaved(false), 3000);
  };

  const handleAddOrder = () => {
    const newPO: PurchaseOrder = {
      orderId: `PO-CUSTOM-${Date.now()}`,
      productKey: "golf_polo",
      quantity: 0,
      orderDate: "2026-09-30",
      expectedArrival: "2026-10-05",
      status: "pending",
    };
    setEditOrders([...editOrders, newPO]);
  };

  const handleRemoveOrder = (orderId: string) => {
    setEditOrders(editOrders.filter((o) => o.orderId !== orderId));
  };

  const updateOrder = (orderId: string, field: keyof PurchaseOrder, value: string | number) => {
    setEditOrders(editOrders.map((o) => (o.orderId === orderId ? { ...o, [field]: value } : o)));
  };

  const pendingOrders = getPendingOrders(state);
  const transactions = [...state.transactions].reverse();

  // On-order summary
  const onOrderSummary = PRODUCTS.map((p) => ({
    p,
    onOrder: getOnOrderQty(state, p.key),
    stock: state.inventory[p.key].currentStock,
  }));
  const totalOnOrder = onOrderSummary.reduce((s, r) => s + r.onOrder, 0);
  const initIP = onOrderSummary.reduce(
    (s, r) => s + r.stock + r.onOrder - state.inventory[r.p.key].backorders,
    0
  );

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage initial inventory, run daily simulation, and monitor transactions
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
              Reset System
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
            { id: "setup", label: "Initial Inventory Setup" },
            { id: "transactions", label: "Transaction Log" },
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

        {/* Tab: Daily Simulation */}
        {activeTab === "daily" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-gray-900">Simulate Next Day</h2>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
                <strong>How it works:</strong> Enter actual sales for each product today. The system will:
                (1) Receive any POs due today · (2) Reduce stock by sales · (3) Record lost sales if stock insufficient ·
                (4) Advance the system date.
              </div>

              <div className="space-y-3 mb-5">
                {PRODUCTS.map((p) => (
                  <div key={p.key}>
                    <label className="label">{p.shortName} — Actual Sales Today</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        value={salesInput[p.key]}
                        onChange={(e) => setSalesInput({ ...salesInput, [p.key]: e.target.value })}
                        placeholder="0"
                        className="input-field"
                      />
                      <span className="text-xs text-gray-400 w-24 flex-shrink-0">
                        Stock: {state.inventory[p.key].currentStock}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSimulate}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                Advance to Next Day ({state.currentDate} → next)
              </button>
            </div>

            {/* Current Status */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-semibold text-gray-900">Current Inventory Status</h2>
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

              {/* Upcoming POs */}
              {pendingOrders.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Incoming Orders</div>
                  <div className="space-y-2">
                    {pendingOrders
                      .sort((a, b) => a.expectedArrival.localeCompare(b.expectedArrival))
                      .map((po) => {
                        const isToday = po.expectedArrival === state.currentDate;
                        const isTomorrow = po.expectedArrival > state.currentDate;
                        return (
                          <div
                            key={po.orderId}
                            className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                              isToday ? "bg-green-50 border border-green-200" : "bg-gray-50"
                            }`}
                          >
                            <span className="font-mono text-gray-500">{po.orderId}</span>
                            <span className="font-medium">{PRODUCT_MAP[po.productKey]?.shortName}</span>
                            <span className="font-bold">{po.quantity}u</span>
                            <span className={`ml-auto ${isToday ? "text-green-700 font-semibold" : "text-gray-500"}`}>
                              {isToday ? "Arrives TODAY" : `Arrives ${formatDate(po.expectedArrival)}`}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Initial Inventory Setup */}
        {activeTab === "setup" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Initial Stock Setup</h2>
                <span className="text-xs text-gray-400">Operating Date: {state.currentDate}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
                <strong>Note:</strong> This sets the current stock for all products. Use "Reset System" to fully restore default initial conditions.
              </div>
              <div className="space-y-3 mb-5">
                {PRODUCTS.map((p) => (
                  <div key={p.key}>
                    <label className="label">{p.shortName} — Current Stock</label>
                    <input
                      type="number"
                      min={0}
                      value={editStock[p.key]}
                      onChange={(e) => setEditStock({ ...editStock, [p.key]: e.target.value })}
                      className="input-field"
                    />
                  </div>
                ))}
              </div>

              {/* On-Order Setup */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Purchase Orders Shipped</h3>
                  <button onClick={handleAddOrder} className="btn-secondary text-xs flex items-center gap-1 py-1">
                    Add PO
                  </button>
                </div>
                <div className="space-y-3">
                  {editOrders.map((po) => (
                    <div key={po.orderId} className="bg-gray-50 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-gray-500">{po.orderId}</span>
                        <button onClick={() => handleRemoveOrder(po.orderId)} className="text-red-400 hover:text-red-600">
                          <span className="text-xs">Remove</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Product</label>
                          <select
                            className="input-field text-xs"
                            value={po.productKey}
                            onChange={(e) => updateOrder(po.orderId, "productKey", e.target.value as ProductKey)}
                          >
                            {PRODUCTS.map((p) => (
                              <option key={p.key} value={p.key}>{p.shortName}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            className="input-field text-xs"
                            value={po.quantity}
                            onChange={(e) => updateOrder(po.orderId, "quantity", Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Order Date</label>
                          <input
                            type="date"
                            className="input-field text-xs"
                            value={po.orderDate}
                            onChange={(e) => updateOrder(po.orderId, "orderDate", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Expected Arrival</label>
                          <input
                            type="date"
                            className="input-field text-xs"
                            value={po.expectedArrival}
                            onChange={(e) => updateOrder(po.orderId, "expectedArrival", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {editOrders.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">No pending purchase orders</div>
                  )}
                </div>
              </div>

              <button
                onClick={handleSaveSetup}
                className="w-full btn-success flex items-center justify-center gap-2"
              >
                {setupSaved ? "Saved!" : "Save Initial Inventory"}
              </button>
            </div>

            {/* Summary */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Initialization Summary</h2>
              <div className="space-y-3">
                {PRODUCTS.map((p) => (
                  <div key={p.key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium">{p.shortName}</span>
                    <span className="font-bold">{editStock[p.key]} units</span>
                  </div>
                ))}
                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Initial Stock</span>
                    <span className="font-bold">
                      {Object.values(editStock).reduce((s, v) => s + (Number(v) || 0), 0)} units
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total On-Order</span>
                    <span className="font-semibold text-indigo-600">
                      {editOrders.reduce((s, o) => s + (Number(o.quantity) || 0), 0)} units
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Operating Date</span>
                    <span className="font-semibold">{state.currentDate}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                After saving, the Dashboard and Inventory Decision pages will reflect these values immediately.
              </div>
            </div>
          </div>
        )}

        {/* Tab: Transaction Log */}
        {activeTab === "transactions" && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Inventory Transaction Log</h2>
              <span className="text-sm text-gray-500">{transactions.length} transactions</span>
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No transactions yet. Run the daily simulation to generate transactions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-2 font-medium text-gray-500">Date</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Product</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Type</th>
                      <th className="text-right pb-2 font-medium text-gray-500">Qty</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 50).map((tx) => {
                      const txConfig = TX_TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-gray-700 bg-gray-50" };
                      return (
                        <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 font-mono text-xs text-gray-600">{tx.date}</td>
                          <td className="py-2.5 font-medium">{PRODUCT_MAP[tx.productKey]?.shortName}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${txConfig.color}`}>
                              {txConfig.label}
                            </span>
                          </td>
                          <td className={`py-2.5 text-right font-mono font-semibold ${
                            tx.type === "STOCKOUT" || tx.type === "SALES" ? "text-red-600" : "text-green-700"
                          }`}>
                            {tx.type === "STOCKOUT" || tx.type === "SALES" ? "-" : "+"}{tx.quantity}
                          </td>
                          <td className="py-2.5 text-xs text-gray-500">{tx.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {transactions.length > 50 && (
                  <div className="text-xs text-gray-400 text-center mt-3">Showing latest 50 of {transactions.length} transactions</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: System Status */}
        {activeTab === "config" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">System Status</h2>
              <div className="space-y-3 text-sm">
                <StatusRow label="Initialization Status" value="Initialized" ok />
                <StatusRow label="Current Operating Date" value={state.currentDate} />
                <StatusRow label="Data Period" value="Jan 2024 – Sep 2026" />
                <StatusRow label="Operational Start" value="Oct 1, 2026" />
                <StatusRow label="Total Transactions" value={String(state.transactions.length)} />
                <StatusRow label="Pending Purchase Orders" value={String(pendingOrders.length)} />
              </div>
            </div>
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Model Configuration</h2>
              <div className="space-y-3 text-sm">
                {PRODUCTS.map((p) => (
                  <div key={p.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{p.shortName}</div>
                      <div className="text-xs text-gray-500">Lead time: {p.leadTime} days</div>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-600 font-semibold">{p.model}</div>
                      <div className="text-xs text-gray-400">H+1 Recursive</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div>
                <div className="font-bold text-gray-900">Reset System?</div>
                <div className="text-sm text-gray-500">This cannot be undone</div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              All transactions, purchase orders placed during the simulation, and date changes will be erased.
              The system will return to the initial state on <strong>October 1, 2026</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleReset} className="btn-danger flex-1">
                Reset System
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold flex items-center gap-1 ${ok ? "text-green-600" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
