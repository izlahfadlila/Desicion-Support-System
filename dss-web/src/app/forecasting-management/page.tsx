"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import {
  Brain,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ProductKey } from "@/lib/types";
import { PRODUCTS, PRODUCT_MAP, PRODUCT_COLORS } from "@/lib/constants";
import {
  MODEL_EVALUATION,
  BEST_MODELS,
  FINAL_FORECASTS,
  MONTHLY_DEMAND,
  LEAD_TIME_UNCERTAINTY,
} from "@/data/forecastData";

const ALL_MODELS = ["ARIMA", "Random Forest", "XGBoost", "Symbolic Regression"];
const MODEL_COLORS: Record<string, string> = {
  ARIMA: "#6366f1",
  "Random Forest": "#16a34a",
  XGBoost: "#d97706",
  "Symbolic Regression": "#dc2626",
};

export default function ForecastingManagementPage() {
  const [selectedProduct, setSelectedProduct] = useState<ProductKey>("golf_polo");
  const [showErrorDetail, setShowErrorDetail] = useState(false);

  const product = PRODUCT_MAP[selectedProduct];
  const bestModelRow = BEST_MODELS.find(
    (b) => b.product === selectedProduct && b.horizon === "H+1"
  );

  // Model evaluation table for selected product
  const evalRows = MODEL_EVALUATION.filter(
    (r) => r.product === selectedProduct && r.horizon === "H+1"
  ).sort((a, b) => a.mae - b.mae);

  // Final forecasts for selected product
  const forecasts = FINAL_FORECASTS.filter((f) => f.product === selectedProduct);

  // Monthly historical chart data
  const histData = MONTHLY_DEMAND.map((m) => ({
    name: m.yearMonth.slice(0, 7),
    golfPolo: m.golfPolo,
    runningShoe: m.runningShoe,
    lifeVest: m.lifeVest,
  }));
  const productHistKey =
    selectedProduct === "golf_polo"
      ? "golfPolo"
      : selectedProduct === "running_shoe"
      ? "runningShoe"
      : "lifeVest";

  // Lead-time uncertainty for selected product
  const ltUncertainty = LEAD_TIME_UNCERTAINTY.filter(
    (r) => r.product === selectedProduct
  ).sort((a, b) => a.leadTime - b.leadTime);

  // Bar chart: model comparison
  const modelCompData = evalRows.map((r) => ({
    model: r.model === "Symbolic Regression" ? "Sym. Reg." : r.model,
    MAE: r.mae,
    RMSE: r.rmse,
    WAPE: r.wape,
  }));

  // SS across lead times

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Forecasting Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor forecast model performance and demand uncertainty analysis
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
            <Info size={14} />
            <span>Admin Access Only</span>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUCTS.map((p) => {
            const best = BEST_MODELS.find((b) => b.product === p.key && b.horizon === "H+1");
            return (
              <div
                key={p.key}
                onClick={() => setSelectedProduct(p.key)}
                className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedProduct === p.key ? "border-blue-500 ring-1 ring-blue-500" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={16} className="text-blue-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Best Model</span>
                </div>
                <div className="text-sm font-bold text-gray-900 mb-0.5">{p.shortName}</div>
                <div className="text-blue-600 font-semibold text-sm">{best?.model ?? "—"}</div>
                <div className="text-xs text-gray-400 mt-1">Val. MAE: {best?.validationMae.toFixed(2) ?? "—"}</div>
              </div>
            );
          })}
          <div className="card p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data Period</div>
            <div className="text-sm font-bold text-gray-900">Jan 2024 – Sep 2026</div>
            <div className="text-xs text-gray-500 mt-1">990 calendar days</div>
            <div className="text-xs text-gray-400 mt-1">Operational: Oct 1, 2026</div>
          </div>
        </div>

        {/* Product Detail Tabs */}
        <div className="card overflow-hidden">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-4">
              <h2 className="font-semibold text-gray-900">Detailed Analysis</h2>
              <div className="flex gap-2">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedProduct(p.key)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      selectedProduct === p.key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {p.shortName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 space-y-6">
            {/* Historical Demand Chart */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                Historical Monthly Demand — {product.name}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={histData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line
                    type="monotone"
                    dataKey={productHistKey}
                    name="Monthly Demand"
                    stroke={PRODUCT_COLORS[selectedProduct]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Model Performance Table */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" />
                Model Performance Comparison (H+1, Test Set)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left pb-2 font-medium text-gray-500">Model</th>
                      <th className="text-right pb-2 font-medium text-gray-500">MAE ↓</th>
                      <th className="text-right pb-2 font-medium text-gray-500">RMSE ↓</th>
                      <th className="text-right pb-2 font-medium text-gray-500">WAPE (%) ↓</th>
                      <th className="text-right pb-2 font-medium text-gray-500">Bias (%)</th>
                      <th className="text-left pb-2 font-medium text-gray-500 pl-4">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalRows.map((row, idx) => {
                      const isBest = row.model === bestModelRow?.model;
                      return (
                        <tr
                          key={row.model}
                          className={`border-b border-gray-50 ${isBest ? "bg-green-50" : ""}`}
                        >
                          <td className="py-3 font-medium flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: MODEL_COLORS[row.model] ?? "#888" }}
                            />
                            {row.model}
                            {isBest && (
                              <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full font-semibold">
                                Selected
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-right font-mono">{row.mae.toFixed(3)}</td>
                          <td className="py-3 text-right font-mono">{row.rmse.toFixed(3)}</td>
                          <td className="py-3 text-right font-mono">{row.wape.toFixed(2)}</td>
                          <td className={`py-3 text-right font-mono ${row.bias > 0 ? "text-amber-600" : "text-blue-600"}`}>
                            {row.bias > 0 ? "+" : ""}{row.bias.toFixed(2)}
                          </td>
                          <td className="py-3 pl-4">
                            {idx === 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                                <CheckCircle size={12} /> Best
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">#{idx + 1}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                ↓ = lower is better · Bias: positive = overforecast, negative = underforecast
              </div>
            </div>

            {/* MAE Comparison Bar */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3">MAE Comparison (H+1 Test)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={modelCompData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="model" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar
                    dataKey="MAE"
                    radius={[0, 4, 4, 0]}
                    fill={PRODUCT_COLORS[selectedProduct]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast Results */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3">Final Forecast (Origin: Sep 30, 2026)</div>
              <div className="grid grid-cols-3 gap-3">
                {forecasts.map((f) => (
                  <div key={f.horizon} className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500 mb-1">{f.horizon} Forecast</div>
                    <div className="text-2xl font-bold" style={{ color: PRODUCT_COLORS[selectedProduct] }}>
                      {f.forecastDemandRounded}
                    </div>
                    <div className="text-xs text-gray-400">units on {f.forecastDate}</div>
                    <div className="text-xs text-gray-300 mt-0.5">Model: {f.model}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead-Time Uncertainty / Safety Stock */}
            <div>
              <button
                className="w-full flex items-center justify-between py-2 text-sm font-semibold text-gray-700 hover:text-blue-700 transition-colors"
                onClick={() => setShowErrorDetail(!showErrorDetail)}
              >
                <span className="flex items-center gap-2">
                  <Info size={15} className="text-blue-500" />
                  Dynamic Safety Stock — Cumulative Lead-Time Error Distribution
                </span>
                {showErrorDetail ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showErrorDetail && (
                <div className="mt-3 space-y-4">
                  <div className="text-xs text-gray-500">
                    SS = max(0, Qα(E_LT)) where E_LT is the cumulative lead-time forecast error.
                    Values below are the quantile (safety stock) at each service level and lead time.
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={ltUncertainty.map((r) => ({
                      lt: `${r.leadTime}d`,
                      "SS 90%": Number(r.p90.toFixed(1)),
                      "SS 95%": Number(r.p95.toFixed(1)),
                      "SS 99%": Number(r.p99.toFixed(1)),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="lt" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="SS 90%" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="SS 95%" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="SS 99%" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left pb-2 font-medium text-gray-500">Lead Time</th>
                          <th className="text-right pb-2 font-medium text-gray-500">Mean Err</th>
                          <th className="text-right pb-2 font-medium text-gray-500">Std</th>
                          <th className="text-right pb-2 font-medium text-gray-500">SS (90%)</th>
                          <th className="text-right pb-2 font-medium text-gray-500">SS (95%)</th>
                          <th className="text-right pb-2 font-medium text-gray-500">SS (99%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ltUncertainty.map((r) => (
                          <tr
                            key={r.leadTime}
                            className={`border-b border-gray-50 ${
                              r.leadTime === product.leadTime ? "bg-blue-50 font-semibold" : ""
                            }`}
                          >
                            <td className="py-1.5">
                              {r.leadTime} day{r.leadTime > 1 ? "s" : ""}
                              {r.leadTime === product.leadTime && (
                                <span className="ml-1 text-blue-500 text-xs">(default)</span>
                              )}
                            </td>
                            <td className="py-1.5 text-right font-mono">{r.meanError.toFixed(2)}</td>
                            <td className="py-1.5 text-right font-mono">{r.errorStd.toFixed(2)}</td>
                            <td className="py-1.5 text-right font-mono">{r.p90.toFixed(1)}</td>
                            <td className="py-1.5 text-right font-mono">{r.p95.toFixed(1)}</td>
                            <td className="py-1.5 text-right font-mono">{r.p99.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
