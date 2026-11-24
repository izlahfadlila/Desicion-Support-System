// ============================================================
// OUTL Calculation Engine — Pure TypeScript, no dependencies
// ============================================================

import type { ProductKey, ServiceLevel, OUTLResult, SensitivityRow } from "./types";
import { LEAD_TIME_UNCERTAINTY, MEAN_DAILY_DEMAND } from "../data/forecastData";
import { getDailyForecastSeries } from "../data/dailyData";
import { PRODUCT_MAP } from "./constants";

/**
 * The cumulative lead-time error table only covers lead times 1–7 days
 * (the maximum forecast horizon). For longer lead times (8–10 days) there is
 * no empirical error, so the quantile is extrapolated with a linear
 * least-squares fit of the 1–7 day values (never lower than the 7-day value).
 */
function extrapolateSafetyStock(
  productKey: ProductKey,
  leadTime: number,
  serviceLevel: ServiceLevel
): number {
  const rows = LEAD_TIME_UNCERTAINTY.filter((r) => r.product === productKey);
  if (rows.length < 2) return 0;
  const pick = (r: (typeof rows)[number]) =>
    serviceLevel === 90 ? r.p90 : serviceLevel === 95 ? r.p95 : r.p99;
  const n = rows.length;
  const sx = rows.reduce((s, r) => s + r.leadTime, 0);
  const sy = rows.reduce((s, r) => s + pick(r), 0);
  const sxy = rows.reduce((s, r) => s + r.leadTime * pick(r), 0);
  const sxx = rows.reduce((s, r) => s + r.leadTime * r.leadTime, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const maxRow = rows.reduce((a, b) => (b.leadTime > a.leadTime ? b : a));
  return Math.max(0, pick(maxRow), intercept + slope * leadTime);
}

/**
 * Get the Dynamic Safety Stock value from lead-time uncertainty table.
 * SS = max(0, Qα(E_LT))
 */
export function getDynamicSafetyStock(
  productKey: ProductKey,
  leadTime: number,
  serviceLevel: ServiceLevel
): number {
  const row = LEAD_TIME_UNCERTAINTY.find(
    (r) => r.product === productKey && r.leadTime === leadTime
  );
  if (!row) return extrapolateSafetyStock(productKey, leadTime, serviceLevel);

  let quantileValue: number;
  if (serviceLevel === 90) quantileValue = row.p90;
  else if (serviceLevel === 95) quantileValue = row.p95;
  else quantileValue = row.p99;

  return Math.max(0, quantileValue);
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Get daily forecast for a specific date from the H+1..H+7 series,
 * falling back to September mean for dates outside 2026-10-01..2026-10-07.
 */
export function getDailyForecast(
  productKey: ProductKey,
  currentDate: string = "2026-10-01"
): number {
  const series = getDailyForecastSeries(productKey);
  const match = series.find((p) => p.date === currentDate);
  if (match) return match.forecast;
  return MEAN_DAILY_DEMAND[productKey] ?? 8;
}

/**
 * Compute Lead Time Demand by summing the daily forecast for each day
 * over the lead time window [currentDate, currentDate + leadTime - 1].
 * Uses interpolated H+1..H+7 forecasts where available and MEAN_DAILY_DEMAND beyond Oct 7.
 */
export function getLeadTimeDemand(
  productKey: ProductKey,
  leadTime: number,
  currentDate: string = "2026-10-01"
): number {
  const series = getDailyForecastSeries(productKey);
  const forecastByDate = new Map(series.map((p) => [p.date, p.forecast]));
  const fallback = MEAN_DAILY_DEMAND[productKey] ?? 8;

  let total = 0;
  for (let i = 0; i < leadTime; i++) {
    const date = addDaysISO(currentDate, i);
    total += forecastByDate.get(date) ?? fallback;
  }
  return total;
}

/**
 * Main OUTL calculation function.
 * Returns the full recommendation result for a product given parameters.
 */
export function calculateOUTL(
  productKey: ProductKey,
  currentStock: number,
  onOrder: number,
  backorders: number,
  leadTime: number,
  serviceLevel: ServiceLevel,
  currentDate?: string
): OUTLResult {
  const dailyForecast = getDailyForecast(productKey, currentDate);
  const ltdForecast = getLeadTimeDemand(productKey, leadTime, currentDate);
  const safetyStock = getDynamicSafetyStock(productKey, leadTime, serviceLevel);
  const targetStock = ltdForecast + safetyStock;
  const inventoryPosition = currentStock + onOrder - backorders;
  const orderQuantity = Math.max(0, targetStock - inventoryPosition);

  let status: "normal" | "reorder" | "critical";
  const ipRatio = inventoryPosition / targetStock;
  if (orderQuantity === 0) {
    status = "normal";
  } else if (ipRatio < 0.5) {
    status = "critical";
  } else {
    status = "reorder";
  }

  return {
    productKey,
    leadTime,
    serviceLevel,
    dailyForecast,
    ltdForecast: Math.round(ltdForecast * 10) / 10,
    safetyStock: Math.round(safetyStock * 10) / 10,
    targetStock: Math.round(targetStock * 10) / 10,
    currentStock,
    onOrder,
    backorders,
    inventoryPosition,
    orderQuantity: Math.ceil(orderQuantity),
    status,
  };
}

/**
 * Compute sensitivity analysis across all service levels for a product.
 */
export function calculateSensitivity(
  productKey: ProductKey,
  currentStock: number,
  onOrder: number,
  backorders: number,
  leadTime: number,
  currentDate?: string
): SensitivityRow[] {
  const levels: ServiceLevel[] = [90, 95, 99];
  return levels.map((sl) => {
    const result = calculateOUTL(
      productKey,
      currentStock,
      onOrder,
      backorders,
      leadTime,
      sl,
      currentDate
    );
    return {
      serviceLevel: sl,
      safetyStock: result.safetyStock,
      targetStock: result.targetStock,
      orderQuantity: result.orderQuantity,
    };
  });
}

/**
 * Calculate default lead time for a product from the product map.
 */
export function getDefaultLeadTime(productKey: ProductKey): number {
  return PRODUCT_MAP[productKey]?.leadTime ?? 5;
}
