// ============================================================
// Daily demand history & daily forecast series (7 days back, 7 days ahead)
// Source: forecast_outputs/demand_history.csv (last 7 days) and
//         forecast_outputs/final_forecasts.csv (origin = 2026-09-30)
// ============================================================

import type { ProductKey } from "../lib/types";
import { FINAL_FORECASTS } from "./forecastData";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  demand: number;
}

// Actual daily demand for the last 7 days of data (24 Sep – 30 Sep 2026)
export const DAILY_HISTORY: Record<ProductKey, DailyPoint[]> = {
  golf_polo: [
    { date: "2026-09-24", demand: 5 },
    { date: "2026-09-25", demand: 0 },
    { date: "2026-09-26", demand: 15 },
    { date: "2026-09-27", demand: 1 },
    { date: "2026-09-28", demand: 2 },
    { date: "2026-09-29", demand: 5 },
    { date: "2026-09-30", demand: 11 },
  ],
  running_shoe: [
    { date: "2026-09-24", demand: 0 },
    { date: "2026-09-25", demand: 1 },
    { date: "2026-09-26", demand: 4 },
    { date: "2026-09-27", demand: 5 },
    { date: "2026-09-28", demand: 8 },
    { date: "2026-09-29", demand: 0 },
    { date: "2026-09-30", demand: 0 },
  ],
  life_vest: [
    { date: "2026-09-24", demand: 2 },
    { date: "2026-09-25", demand: 1 },
    { date: "2026-09-26", demand: 0 },
    { date: "2026-09-27", demand: 2 },
    { date: "2026-09-28", demand: 3 },
    { date: "2026-09-29", demand: 0 },
    { date: "2026-09-30", demand: 4 },
  ],
};

export interface DailyForecastPoint {
  date: string;
  forecast: number;
  interpolated: boolean;
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Daily forecast for H+1 … H+7.
 * The model outputs exist for H+1, H+3 and H+7; H+2 and H+4…H+6 are linearly
 * interpolated between the nearest model outputs.
 */
export function getDailyForecastSeries(productKey: ProductKey): DailyForecastPoint[] {
  const origin = "2026-09-30";
  const known: Record<number, number> = {};
  for (const f of FINAL_FORECASTS) {
    if (f.product !== productKey) continue;
    const h = Number(f.horizon.replace("H+", ""));
    known[h] = f.forecastDemand;
  }
  const anchors = Object.keys(known).map(Number).sort((a, b) => a - b);
  const result: DailyForecastPoint[] = [];
  for (let h = 1; h <= 7; h++) {
    let value: number;
    let interpolated = false;
    if (known[h] !== undefined) {
      value = known[h];
    } else {
      interpolated = true;
      const lo = [...anchors].reverse().find((a) => a < h) ?? anchors[0];
      const hi = anchors.find((a) => a > h) ?? anchors[anchors.length - 1];
      value = lo === hi ? known[lo] : known[lo] + ((known[hi] - known[lo]) * (h - lo)) / (hi - lo);
    }
    result.push({
      date: addDaysISO(origin, h),
      forecast: Math.round(value * 100) / 100,
      interpolated,
    });
  }
  return result;
}
