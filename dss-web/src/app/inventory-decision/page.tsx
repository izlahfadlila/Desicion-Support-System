"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SystemState, ProductKey, ServiceLevel, OUTLResult, SensitivityRow } from "@/lib/types";
import { loadState, getOnOrderQty, saveState, addPurchaseOrder, formatDate, formatDateLong } from "@/lib/store";
import { calculateOUTL, calculateSensitivity, getDefaultLeadTime } from "@/lib/calculations";
import { PRODUCTS, PRODUCT_MAP, PRODUCT_COLORS, MAX_LEAD_TIME } from "@/lib/constants";
import { MONTHLY_DEMAND, FINAL_FORECASTS } from "@/data/forecastData";
import { DAILY_HISTORY, getDailyForecastSeries } from "@/data/dailyData";

type ProductKeyType = ProductKey;

function InventoryDecisionContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<SystemState | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductKeyType>("golf_polo");
  const [leadTime, setLeadTime] = useState<number>(5);
  const [serviceLevel, setServiceLevel] = useState<ServiceLevel>(95);
  const [result, setResult] = useState<OUTLResult | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityRow[] | null>(null);
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [chartView, setChartView] = useState<"daily" | "monthly">("daily");

  const refresh = useCallback(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    refresh();
    const pKey = searchParams.get("product") as ProductKeyType | null;
    if (pKey && PRODUCTS.find((p) => p.key === pKey)) {
      setSelectedProduct(pKey);
    }
    window.addEventListener("dss_state_changed", refresh);
    return () => window.removeEventListener("dss_state_changed", refresh);
  }, [refresh, searchParams]);

  useEffect(() => {
    if (selectedProduct) {
      const lt = getDefaultLeadTime(selectedProduct);
      setLeadTime(lt);
      setResult(null);
      setSensitivity(null);
      setOrderPlaced(false);
    }
  }, [selectedProduct]);

  if (!state) return <AppLayout><div className="p-8 text-gray-500">Loading...</div></AppLayout>;

  const inv = state.inventory[selectedProduct];
  const onOrder = getOnOrderQty(state, selectedProduct);
  const product = PRODUCT_MAP[selectedProduct];

  const handleGenerate = () => {
    const r = calculateOUTL(
      selectedProduct,
      inv.currentStock,
      onOrder,
      inv.backorders,
      leadTime,
      serviceLevel,
      state.currentDate
    );
    setResult(r);
    setSensitivity(calculateSensitivity(
      selectedProduct,
      inv.currentStock,
      onOrder,
      inv.backorders,
      leadTime,
      state.currentDate
    ));
    setOrderPlaced(false);
  };

  const handlePlaceOrder = () => {
    if (!result || result.orderQuantity === 0) return;
    const newState = addPurchaseOrder(state, selectedProduct, result.orderQuantity, leadTime);
    setState(newState);
    window.dispatchEvent(new Event("dss_state_changed"));
    setShowConfirmModal(false);
    setOrderPlaced(true);
    setResult(null);
  };

  // Chart data: last 6 months + forecast
  const chartData = MONTHLY_DEMAND.slice(-6).map((m) => ({
    name: m.yearMonth.slice(5),
    demand: m[selectedProduct === "golf_polo" ? "golfPolo" : selectedProduct === "running_shoe" ? "runningShoe" : "lifeVest"],
  }));
  const fmtDay = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const dailyHistory = DAILY_HISTORY[selectedProduct];
  const dailyForecast = getDailyForecastSeries(selectedProduct);
  const lastActual = dailyHistory[dailyHistory.length - 1];
  const dailyChartData = [
    ...dailyHistory.map((d, i) => ({
      name: fmtDay(d.date),
      actual: d.demand,
      // connect the forecast line to the last actual point
      forecast: i === dailyHistory.length - 1 ? d.demand : undefined,
    })),
    ...dailyForecast.map((f) => ({ name: fmtDay(f.date), actual: undefined, forecast: f.forecast })),
  ];
  const hasInterpolated = dailyForecast.some((f) => f.interpolated);
  const h1Forecast = FINAL_FORECASTS.find((f) => f.product === selectedProduct && f.horizon === "H+1");
  const h7Forecast = FINAL_FORECASTS.find((f) => f.product === selectedProduct && f.horizon === "H+7");

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Decision</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate order replenishment recommendations based on demand forecasting and dynamic safety stock
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Panel */}
          <div className="xl:col-span-1 space-y-5">
            {/* Product Selection */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Product Selection</h2>
              <div className="space-y-2">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedProduct(p.key)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedProduct === p.key
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-900">{p.shortName}</span>
                      <span className="text-xs text-gray-400">{p.model}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Inventory */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Current Inventory</h2>
              <div className="space-y-2.5">
                <InfoRow label="Current Stock" value={`${inv.currentStock} units`} bold />
                <InfoRow label="On-Order Inventory" value={`${onOrder} units`} color="indigo" />
                <InfoRow label="Backorders" value={`${inv.backorders} units`} />
                <div className="border-t border-gray-100 pt-2.5">
                  <InfoRow
                    label="Inventory Position"
                    value={`${inv.currentStock + onOrder - inv.backorders} units`}
                    bold
                    color="blue"
                  />
                  <div className="text-xs text-gray-400 mt-1">IP = Stock + On-Order − Backorders</div>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Inventory Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Lead Time (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_LEAD_TIME}
                    value={leadTime}
                    onChange={(e) => setLeadTime(Math.max(1, Math.min(MAX_LEAD_TIME, Number(e.target.value))))}
                    className="input-field"
                  />
                  <div className="text-xs text-gray-400 mt-1">Default: {getDefaultLeadTime(selectedProduct)} days for {product?.shortName} · Max: {MAX_LEAD_TIME} days</div>
                  {leadTime > 7 && (
                    <div className="text-xs text-blue-700 mt-1">
                      Forecast error data covers up to 7 days; safety stock for {leadTime} days is extrapolated.
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Target Service Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([90, 95, 99] as ServiceLevel[]).map((sl) => (
                      <button
                        key={sl}
                        onClick={() => setServiceLevel(sl)}
                        className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                          serviceLevel === sl
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {sl}%
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Probability of no stockout during lead time</div>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                className="w-full mt-4 btn-primary flex items-center justify-center gap-2"
              >
                Generate Recommendation
              </button>
            </div>
          </div>

          {/* Right Panel */}
          <div className="xl:col-span-2 space-y-5">
            {/* Forecast Overview */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="font-semibold text-gray-900">Demand Forecast Overview</h2>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {(["daily", "monthly"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setChartView(v)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          chartView === v ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {v === "daily" ? "Daily" : "Monthly"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: PRODUCT_COLORS[selectedProduct] }} /> Historical
                    </span>
                    {chartView === "daily" && (
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-blue-300 inline-block" /> Forecast
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {chartView === "monthly" ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="demand"
                      name="Monthly Demand"
                      stroke={PRODUCT_COLORS[selectedProduct]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <ReferenceLine x={fmtDay(lastActual.date)} stroke="#8b9dc3" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="actual"
                        name="Actual Demand"
                        stroke={PRODUCT_COLORS[selectedProduct]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        name="Forecast"
                        stroke="#8b9dc3"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="text-xs text-gray-400 mt-1">
                    Last 7 days (actual) and next 7 days (forecast per day)
                    {hasInterpolated && " · H+2 and H+4–H+6 are interpolated between model outputs (H+1, H+3, H+7)"}
                  </div>
                </>
              )}
              <div className="mt-3 grid grid-cols-3 gap-3">
                <ForecastCard label="H+1 Forecast" value={h1Forecast?.forecastDemandRounded ?? "—"} unit="units/day" />
                <ForecastCard label="H+7 Forecast" value={h7Forecast?.forecastDemandRounded ?? "—"} unit="units" />
                <ForecastCard label="LTD Estimate" value={h1Forecast ? Math.round(h1Forecast.forecastDemand * leadTime) : "—"} unit={`over ${leadTime} days`} />
              </div>
            </div>

            {/* Recommendation Result */}
            {orderPlaced && (
              <div className="card p-5 border-green-300 bg-green-50">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-semibold text-green-800">Purchase Order Placed Successfully</div>
                    <div className="text-sm text-green-600">
                      The order has been recorded and added to your incoming orders.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!result && !orderPlaced && (
              <div className="card p-10 text-center border-dashed">
                <div className="text-gray-500 font-medium">Configure parameters and click</div>
                <div className="text-blue-600 font-semibold">"Generate Recommendation"</div>
                <div className="text-sm text-gray-400 mt-1">to calculate your replenishment order</div>
              </div>
            )}

            {result && (
              <>
                {/* Recommendation Cards */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Recommendation Result</h2>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      result.status === "normal" ? "bg-green-100 text-green-700" :
                      result.status === "critical" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {result.status === "normal" ? "Normal" : result.status === "critical" ? "Critical" : "Reorder Required"}
                    </span>
                  </div>

                  {/* Main Result Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    <ResultCard
                      label="Lead Time Demand"
                      value={result.ltdForecast.toFixed(1)}
                      unit="units"
                      formula={`${result.dailyForecast.toFixed(2)} × ${result.leadTime} days`}
                    />
                    <ResultCard
                      label="Dynamic Safety Stock"
                      value={result.safetyStock.toFixed(1)}
                      unit="units"
                      formula={`Q${serviceLevel}% of cumulative error`}
                    />
                    <ResultCard
                      label="Target Stock (S)"
                      value={result.targetStock.toFixed(1)}
                      unit="units"
                      formula={`LTD + Safety Stock`}
                    />
                    <ResultCard
                      label="Inventory Position"
                      value={String(result.inventoryPosition)}
                      unit="units"
                      formula={`${result.currentStock} + ${result.onOrder} − ${result.backorders}`}
                    />
                    <div className="col-span-2 md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-blue-600 flex items-center gap-1 mb-1">
                            Recommended Order Quantity
                          </div>
                          <div className="text-4xl font-bold text-blue-700">
                            {result.orderQuantity}
                          </div>
                          <div className="text-xs text-blue-500 mt-1">
                            units · Q = max(0, {result.targetStock.toFixed(0)} − {result.inventoryPosition})
                          </div>
                        </div>
                        {result.orderQuantity > 0 && (
                          <button
                            onClick={() => setShowConfirmModal(true)}
                            className="btn-primary flex items-center gap-2 text-sm"
                          >
                            Place Order
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                    <div className="flex items-start gap-2">
                      <div>
                        {result.orderQuantity === 0 ? (
                          <>
                            <strong>No replenishment needed.</strong> Current inventory position ({result.inventoryPosition} units)
                            exceeds the target stock ({result.targetStock.toFixed(0)} units), which covers estimated demand
                            during the {result.leadTime}-day lead time ({result.ltdForecast.toFixed(0)} units)
                            plus dynamic safety stock ({result.safetyStock.toFixed(0)} units) at {serviceLevel}% service level.
                          </>
                        ) : (
                          <>
                            <strong>Replenishment recommended.</strong> Current inventory position ({result.inventoryPosition} units)
                            is below the target stock ({result.targetStock.toFixed(0)} units). The system recommends ordering{" "}
                            <strong className="text-blue-700">{result.orderQuantity} units</strong> to ensure sufficient
                            coverage during the {result.leadTime}-day lead time, including {result.safetyStock.toFixed(0)} units
                            of dynamic safety stock at {serviceLevel}% service level.
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sensitivity Analysis */}
                <div className="card overflow-hidden">
                  <button
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    onClick={() => setShowSensitivity(!showSensitivity)}
                  >
                    <span className="font-semibold text-gray-900">Sensitivity Analysis — Service Level Impact</span>
                    <span className="text-xs font-medium text-gray-500">{showSensitivity ? "Hide" : "Show"}</span>
                  </button>
                  {showSensitivity && sensitivity && (
                    <div className="px-5 pb-5">
                      <div className="text-xs text-gray-500 mb-3">
                        Fixed Lead Time: {leadTime} days · Current IP: {result.inventoryPosition} units
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left pb-2 font-medium text-gray-500">Service Level</th>
                            <th className="text-right pb-2 font-medium text-gray-500">Safety Stock</th>
                            <th className="text-right pb-2 font-medium text-gray-500">Target Stock (S)</th>
                            <th className="text-right pb-2 font-medium text-gray-500">Order Quantity (Q)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sensitivity.map((row) => (
                            <tr
                              key={row.serviceLevel}
                              className={`border-b border-gray-50 ${row.serviceLevel === serviceLevel ? "bg-blue-50" : ""}`}
                            >
                              <td className="py-2.5">
                                <span className={`font-medium ${row.serviceLevel === serviceLevel ? "text-blue-700" : "text-gray-700"}`}>
                                  {row.serviceLevel}%
                                  {row.serviceLevel === serviceLevel && <span className="ml-2 text-xs text-blue-500">(selected)</span>}
                                </span>
                              </td>
                              <td className="py-2.5 text-right font-mono">{row.safetyStock.toFixed(1)}</td>
                              <td className="py-2.5 text-right font-mono">{row.targetStock.toFixed(1)}</td>
                              <td className={`py-2.5 text-right font-mono font-bold ${row.orderQuantity > 0 ? "text-red-600" : "text-green-600"}`}>
                                {row.orderQuantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="text-xs text-gray-400 mt-2">
                        Higher service level → higher safety stock → higher protection against stockout
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Order Modal */}
      {showConfirmModal && result && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Confirm Purchase Order</h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-sm">Close</span>
              </button>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex justify-between"><span>Product:</span><span className="font-semibold">{product?.shortName}</span></div>
                <div className="flex justify-between"><span>Order Quantity:</span><span className="font-bold text-blue-700 text-lg">{result.orderQuantity} units</span></div>
                <div className="flex justify-between"><span>Lead Time:</span><span className="font-semibold">{leadTime} days</span></div>
                <div className="flex justify-between"><span>Est. Arrival:</span><span className="font-semibold">~{leadTime} days from today</span></div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              This will create a Purchase Order and add it to your on-order inventory. The order status will appear in the Dashboard.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handlePlaceOrder} className="btn-primary flex-1">
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function InventoryDecisionPage() {
  return (
    <Suspense fallback={<AppLayout><div className="p-8 text-gray-500">Loading...</div></AppLayout>}>
      <InventoryDecisionContent />
    </Suspense>
  );
}

function InfoRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm ${bold ? "font-bold" : "font-medium"} ${
        color === "blue" ? "text-blue-700" : color === "indigo" ? "text-indigo-600" : "text-gray-900"
      }`}>{value}</span>
    </div>
  );
}

function ForecastCard({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400">{unit}</div>
    </div>
  );
}

function ResultCard({ label, value, unit, formula }: {
  label: string; value: string; unit: string; formula: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="mb-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{unit}</div>
      <div className="text-xs text-gray-300 mt-1 font-mono">{formula}</div>
    </div>
  );
}
