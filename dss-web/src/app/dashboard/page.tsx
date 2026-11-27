"use client";

import { useState, useEffect, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SystemState, ProductKey } from "@/lib/types";
import { loadState, getOnOrderQty, getPendingOrders, formatDate } from "@/lib/store";
import { calculateOUTL } from "@/lib/calculations";
import { PRODUCTS, PRODUCT_MAP, PRODUCT_COLORS } from "@/lib/constants";

const DEFAULT_SL = 95 as const;

export default function DashboardPage() {
  const [state, setState] = useState<SystemState | null>(null);
  const router = useRouter();

  const refresh = useCallback(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("dss_state_changed", refresh);
    return () => window.removeEventListener("dss_state_changed", refresh);
  }, [refresh]);

  if (!state) return <AppLayout><div className="p-8 text-gray-500">Loading...</div></AppLayout>;

  // Compute OUTL for all products
  const results = PRODUCTS.map((p) => {
    const inv = state.inventory[p.key];
    const onOrder = getOnOrderQty(state, p.key);
    return calculateOUTL(
      p.key,
      inv.currentStock,
      onOrder,
      inv.backorders,
      p.leadTime,
      DEFAULT_SL,
      state.currentDate
    );
  });

  const needsReplenishment = results.filter((r) => r.orderQuantity > 0).length;
  const pendingOrders = getPendingOrders(state);
  const totalStock = results.reduce((sum, r) => sum + r.currentStock, 0);
  const totalOnOrder = results.reduce((sum, r) => sum + r.onOrder, 0);

  const chartData = PRODUCTS.map((p, i) => ({
    name: p.shortName,
    stock: results[i].currentStock,
    onOrder: results[i].onOrder,
    target: Math.round(results[i].targetStock),
  }));

  const statusBadge = (status: string) => {
    if (status === "normal") return <span className="badge-normal">Normal</span>;
    if (status === "critical") return <span className="badge-critical">Critical</span>;
    return <span className="badge-reorder">Reorder Required</span>;
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor inventory performance and replenishment status
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span>Service Level: 95% · Operational since Oct 1, 2026</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Products"
            value="3"
            sub="Managed products"
            color="blue"
          />
          <SummaryCard
            label="Need Replenishment"
            value={String(needsReplenishment)}
            sub={`out of 3 products`}
            color="amber"
            highlight={needsReplenishment > 0}
          />
          <SummaryCard
            label="Processing Orders"
            value={String(pendingOrders.length)}
            sub="In Progress"
            color="indigo"
          />
          <SummaryCard
            label="Total Inventory"
            value={String(totalStock)}
            sub={`+${totalOnOrder} on order`}
            color="green"
          />
        </div>

        {/* Product Inventory Overview */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Product Inventory Overview</h2>
            <span className="text-xs text-gray-500">At 95% service level</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-3 font-medium text-gray-500">Product</th>
                  <th className="text-right pb-3 font-medium text-gray-500">Current Stock</th>
                  <th className="text-right pb-3 font-medium text-gray-500">On-Order</th>
                  <th className="text-right pb-3 font-medium text-gray-500">Inv. Position</th>
                  <th className="text-right pb-3 font-medium text-gray-500">Target Stock</th>
                  <th className="text-right pb-3 font-medium text-gray-500">Rec. Order</th>
                  <th className="text-left pb-3 font-medium text-gray-500 pl-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTS.map((p, i) => {
                  const r = results[i];
                  return (
                    <tr key={p.key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <span className="font-medium text-gray-900">{p.shortName}</span>
                        <div className="text-xs text-gray-400">{p.name}</div>
                      </td>
                      <td className="text-right py-3 font-mono font-semibold">{r.currentStock}</td>
                      <td className="text-right py-3 font-mono text-indigo-600">{r.onOrder}</td>
                      <td className="text-right py-3 font-mono">{r.inventoryPosition}</td>
                      <td className="text-right py-3 font-mono text-gray-600">{Math.round(r.targetStock)}</td>
                      <td className={`text-right py-3 font-mono font-bold ${r.orderQuantity > 0 ? "text-red-600" : "text-gray-400"}`}>
                        {r.orderQuantity > 0 ? `+${r.orderQuantity}` : "—"}
                      </td>
                      <td className="py-3 pl-4">
                        {statusBadge(r.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Replenishment Recommendation Summary */}
          <div className="card p-5 lg:col-span-2">
            <h2 className="font-semibold text-gray-900 mb-4">Replenishment Recommendations</h2>
            <div className="space-y-3">
              {results.map((r, i) => {
                const p = PRODUCTS[i];
                if (r.orderQuantity === 0) {
                  return (
                    <div key={p.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700">{p.shortName}</div>
                        <div className="text-xs text-gray-500">Stock sufficient — No action needed</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={p.key} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{p.shortName}</div>
                      <div className="text-xs text-gray-600">
                        Order <strong className="text-amber-700">{r.orderQuantity} units</strong> · Target: {Math.round(r.targetStock)} · IP: {r.inventoryPosition}
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/inventory-decision?product=${p.key}`)}
                      className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      View
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Incoming Orders */}
          <div className="card p-5 lg:col-span-3">
            <h2 className="font-semibold text-gray-900 mb-4">Upcoming Incoming Orders</h2>
            {pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No pending orders</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 font-medium text-gray-500">Order ID</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Product</th>
                      <th className="text-right pb-2 font-medium text-gray-500">Qty</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Ordered</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Expected Arrival</th>
                      <th className="text-left pb-2 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders
                      .sort((a, b) => a.expectedArrival.localeCompare(b.expectedArrival))
                      .map((po) => {
                        const isToday = po.expectedArrival === state.currentDate;
                        const isOverdue = po.expectedArrival < state.currentDate;
                        return (
                          <tr key={po.orderId} className={`border-b border-gray-50 ${isToday ? "bg-green-50" : isOverdue ? "bg-amber-50" : ""}`}>
                            <td className="py-2.5 font-mono text-xs text-gray-600">{po.orderId}</td>
                            <td className="py-2.5 font-medium">{PRODUCT_MAP[po.productKey]?.shortName}</td>
                            <td className="py-2.5 text-right font-mono font-semibold">{po.quantity}</td>
                            <td className="py-2.5 text-xs text-gray-500">{formatDate(po.orderDate)}</td>
                            <td className={`py-2.5 text-xs font-medium ${isToday ? "text-green-700" : isOverdue ? "text-amber-700" : "text-gray-700"}`}>
                              {formatDate(po.expectedArrival)}
                              {isToday && <span className="ml-1 text-green-600">(Today!)</span>}
                            </td>
                            <td className="py-2.5">
                              <span className="badge-pending">In Progress</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Inventory Level Overview</h2>
          <div className="text-xs text-gray-500 mb-3">Current Stock vs On-Order vs Target Stock (at 95% service level)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="stock" name="Current Stock" fill="#3b5998" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onOrder" name="On-Order" fill="#8b9dc3" radius={[4, 4, 0, 0]} />
              <Bar dataKey="target" name="Target Stock" fill="#dfe3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
  highlight = false,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-4 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="text-center">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}
