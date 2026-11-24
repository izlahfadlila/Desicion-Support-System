// ============================================================
// OUTL Calculation Engine — Pure TypeScript, no dependencies
// ============================================================

import type { ProductKey, ServiceLevel, OUTLResult, SensitivityRow } from "./types";
import { LEAD_TIME_UNCERTAINTY, FINAL_FORECASTS, MEAN_DAILY_DEMAND } from "../data/forecastData";
import { PRODUCT_MAP } from "./constants";

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
  if (!row) return 0;

  let quantileValue: number;
  if (serviceLevel === 90) quantileValue = row.p90;
  else if (serviceLevel === 95) quantileValue = row.p95;
  else quantileValue = row.p99;

  return Math.max(0, quantileValue);
}

/**
 * Get daily forecast for a product (H+1 from model, or rolling mean after simulation).
 * Falls back to September mean if no specific forecast available.
 */
export function getDailyForecast(
  productKey: ProductKey,
  currentDate?: string
): number {
  // If we're at or near the system start, use the model's H+1 forecast
  if (!currentDate || currentDate <= "2026-10-07") {
    const forecast = FINAL_FORECASTS.find(
      (f) => f.product === productKey && f.horizon === "H+1"
    );
    if (forecast) return forecast.forecastDemand;
  }
  // For later dates, use the September mean as a stable base rate
  return MEAN_DAILY_DEMAND[productKey] ?? 8;
}

/**
 * Compute Lead Time Demand: LTD = daily_forecast × lead_time
 * Uses H+1 forecast as the representative daily demand estimate.
 */
export function getLeadTimeDemand(
  productKey: ProductKey,
  leadTime: number,
  currentDate?: string
): number {
  const daily = getDailyForecast(productKey, currentDate);
  return daily * leadTime;
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
  const ltdForecast = dailyForecast * leadTime;
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
