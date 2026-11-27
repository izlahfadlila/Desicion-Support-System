// ============================================================
// OUTL Calculation Engine — Pure TypeScript, no dependencies
// ============================================================

import type { ProductKey, ServiceLevel, OUTLResult, SensitivityRow } from "./types";
import { LEAD_TIME_UNCERTAINTY, MEAN_DAILY_DEMAND } from "../data/forecastData";
import { ROLLING_FORECASTS } from "../data/rollingForecasts";
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

function getOriginDate(currentDateStr: string): string {
  const d = new Date(currentDateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

/**
 * Get daily forecast for a specific horizon from the pure ML rolling forecasts
 */
export function getDailyForecast(
  productKey: ProductKey,
  currentDate: string = "2026-09-26"
): number {
  const origin = getOriginDate(currentDate);
  const byOrigin = ROLLING_FORECASTS[productKey]?.[origin];
  if (byOrigin && byOrigin[1] !== undefined) {
    return byOrigin[1];
  }
  return MEAN_DAILY_DEMAND[productKey] ?? 8;
}

/**
 * Compute Lead Time Demand by summing the daily pure ML forecast for each horizon H+1..H+L
 */
export function getLeadTimeDemand(
  productKey: ProductKey,
  leadTime: number,
  currentDate: string = "2026-09-26"
): number {
  const origin = getOriginDate(currentDate);
  const byOrigin = ROLLING_FORECASTS[productKey]?.[origin];
  const fallback = MEAN_DAILY_DEMAND[productKey] ?? 8;

  let total = 0;
  for (let h = 1; h <= leadTime; h++) {
    if (byOrigin && byOrigin[h] !== undefined) {
      total += byOrigin[h];
    } else {
      total += fallback;
    }
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
