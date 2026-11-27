"use client";

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
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
} from "recharts";
import { EVALUATION_BENCHMARK } from "@/data/benchmarkData";
import { PRODUCTS, PRODUCT_MAP } from "@/lib/constants";
import type { ServiceLevel } from "@/lib/types";

export default function SystemEvaluationPage() {
  const [selectedSl, setSelectedSl] = useState<ServiceLevel>(95);

  const slKey = String(selectedSl) as "90" | "95" | "99";
  const benchmarkSl = EVALUATION_BENCHMARK.byServiceLevel[slKey];
  const dssSummary = benchmarkSl.dss.summary;
  const baseSummary = benchmarkSl.baseline.summary;

  // Comparison bar chart data across SL 90, 95, 99
  const slComparisonData = ([90, 95, 99] as const).map((sl) => {
    const d = EVALUATION_BENCHMARK.byServiceLevel[String(sl) as "90" | "95" | "99"];
    return {
      serviceLevel: `${sl}%`,
      dssStockout: d.dss.summary.stockoutDays,
      baseStockout: d.baseline.summary.stockoutDays,
      dssLostSales: d.dss.summary.lostSales,
      baseLostSales: d.baseline.summary.lostSales,
      dssAvgStock: d.dss.summary.avgInventory,
      baseAvgStock: d.baseline.summary.avgInventory,
      dssFillRate: d.dss.summary.fillRate,
      baseFillRate: d.baseline.summary.fillRate,
    };
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Evaluation & Benchmark</h1>
            <p className="text-sm text-gray-500 mt-1">
              Trace-driven out-of-sample backtest ({EVALUATION_BENCHMARK.period}, {EVALUATION_BENCHMARK.days} days): DSS (ML + Dynamic SS) vs Traditional Baseline (Z · σ_d · √L)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Test Service Level:</span>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {([90, 95, 99] as ServiceLevel[]).map((sl) => (
                <button
                  key={sl}
                  onClick={() => setSelectedSl(sl)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    selectedSl === sl
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {sl}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Executive Scorecard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Scorecard
            label="Stockout Days"
            dssVal={`${dssSummary.stockoutDays} days`}
            baseVal={`${baseSummary.stockoutDays} days`}
            improvement={`${Math.round(((baseSummary.stockoutDays - dssSummary.stockoutDays) / baseSummary.stockoutDays) * 100)}% reduction`}
            better="dss"
          />
          <Scorecard
            label="Lost Sales"
            dssVal={`${dssSummary.lostSales} units`}
            baseVal={`${baseSummary.lostSales} units`}
            improvement={`${Math.round(((baseSummary.lostSales - dssSummary.lostSales) / baseSummary.lostSales) * 100)}% cut`}
            better="dss"
          />
          <Scorecard
            label="Fill Rate Achieved"
            dssVal={`${dssSummary.fillRate}%`}
            baseVal={`${baseSummary.fillRate}%`}
            improvement={`+${(dssSummary.fillRate - baseSummary.fillRate).toFixed(1)}% higher`}
            better="dss"
          />
          <Scorecard
            label="Avg. Inventory Held"
            dssVal={`${dssSummary.avgInventory} u`}
            baseVal={`${baseSummary.avgInventory} u`}
            improvement={`${dssSummary.avgInventory > baseSummary.avgInventory ? "Protected stock" : "Leaner"}`}
            better="neutral"
          />
        </div>

        {/* Detailed Per-Product Comparison Table */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Per-Product Performance Comparison (SL = {selectedSl}%)</h2>
            <span className="text-xs text-gray-400">Evaluated on real daily sales (Sep 1–25, 2026)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left pb-3 font-medium">Product</th>
                  <th className="text-right pb-3 font-medium">Total Demand</th>
                  <th className="text-right pb-3 font-medium text-blue-700">DSS Stockout</th>
                  <th className="text-right pb-3 font-medium text-gray-400">Base Stockout</th>
                  <th className="text-right pb-3 font-medium text-blue-700">DSS Lost Sales</th>
                  <th className="text-right pb-3 font-medium text-gray-400">Base Lost Sales</th>
                  <th className="text-right pb-3 font-medium text-blue-700">DSS Fill Rate</th>
                  <th className="text-right pb-3 font-medium text-gray-400">Base Fill Rate</th>
                  <th className="text-right pb-3 font-medium">DSS Avg Stock</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCTS.map((p) => {
                  const dssP = benchmarkSl.dss.perProduct[p.key];
                  const baseP = benchmarkSl.baseline.perProduct[p.key];
                  return (
                    <tr key={p.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <span className="font-semibold text-gray-900">{p.shortName}</span>
                        <div className="text-xs text-gray-400">{p.model} · LT: {p.leadTime}d</div>
                      </td>
                      <td className="text-right py-3 font-mono">{dssP.totalDemand} u</td>
                      <td className="text-right py-3 font-mono font-bold text-blue-700">{dssP.stockoutDays} d</td>
                      <td className="text-right py-3 font-mono text-gray-500">{baseP.stockoutDays} d</td>
                      <td className="text-right py-3 font-mono font-bold text-blue-700">{dssP.lostSales} u</td>
                      <td className="text-right py-3 font-mono text-gray-500">{baseP.lostSales} u</td>
                      <td className="text-right py-3 font-mono font-bold text-green-700">{dssP.fillRate}%</td>
                      <td className="text-right py-3 font-mono text-gray-500">{baseP.fillRate}%</td>
                      <td className="text-right py-3 font-mono">{dssP.avgInventory} u</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stockout Days vs Service Level */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Sensitivity Analysis: Stockout Days</h2>
            <p className="text-xs text-gray-400 mb-3">Comparing DSS (ML + Dynamic SS) vs Parametric Baseline (Z·σ·√L)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={slComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="serviceLevel" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="dssStockout" name="DSS Stockout (days)" fill="#3b5998" radius={[4, 4, 0, 0]} />
                <Bar dataKey="baseStockout" name="Baseline Stockout (days)" fill="#c4cce0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Fill Rate vs Service Level */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Sensitivity Analysis: Fill Rate (%)</h2>
            <p className="text-xs text-gray-400 mb-3">Percentage of customer demand fulfilled immediately without stockout</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={slComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="serviceLevel" tick={{ fontSize: 12 }} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="dssFillRate" name="DSS Fill Rate (%)" fill="#2f4779" radius={[4, 4, 0, 0]} />
                <Bar dataKey="baseFillRate" name="Baseline Fill Rate (%)" fill="#8b9dc3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Inventory Trajectory Chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-gray-900">Total Inventory Trajectory (Sep 1–25, 2026)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Combined stock across 3 products under DSS vs Traditional Baseline at 95% SL</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium">SL = 95%</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={EVALUATION_BENCHMARK.dailyTrajectory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="dssStock" name="DSS Stock (ML + Dynamic SS)" stroke="#3b5998" strokeWidth={2.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="baselineStock" name="Baseline Stock (Classic Z·σ·√L)" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Methodology Notes */}
        <div className="card p-5 bg-gray-50 border-gray-200">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">Scientific Benchmark Notes:</h3>
          <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
            <li>
              <strong>Dataset Partition:</strong> Model training cut off strictly at August 31, 2026. September 2026 serves as 100% unseen test reality.
            </li>
            <li>
              <strong>Baseline Formulation:</strong> Classical parametric formula <em>SS = Z · σ_d · √L</em> with historical mean LTD (Silver et al., 2016; Chopra &amp; Meindl, 2016).
            </li>
            <li>
              <strong>Sequence of Events:</strong> End-of-Day (EOD) receipt protocol applied: incoming goods arriving on day <em>t</em> are inspected and made available for sales starting day <em>t+1</em>.
            </li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}

function Scorecard({
  label,
  dssVal,
  baseVal,
  improvement,
  better,
}: {
  label: string;
  dssVal: string;
  baseVal: string;
  improvement: string;
  better: "dss" | "neutral";
}) {
  return (
    <div className="card p-4 border border-blue-100 bg-gradient-to-br from-white to-blue-50/30">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <div>
          <div className="text-2xl font-bold text-blue-700">{dssVal}</div>
          <div className="text-xs text-gray-400 mt-0.5">DSS (Proposed)</div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold text-gray-500">{baseVal}</div>
          <div className="text-xs text-gray-400 mt-0.5">Baseline</div>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-400">Impact:</span>
        <span className={`font-semibold ${better === "dss" ? "text-green-700" : "text-blue-600"}`}>
          {improvement}
        </span>
      </div>
    </div>
  );
}
