import type { Product, ProductKey } from "./types";

export const SYSTEM_START_DATE = "2026-09-26";
export const DATA_END_DATE = "2026-09-30";

export const PRODUCTS: Product[] = [
  {
    key: "golf_polo",
    name: "Nike Men's Dri-FIT Victory Golf Polo",
    shortName: "Golf Polo",
    model: "Random Forest",
    leadTime: 5,
  },
  {
    key: "running_shoe",
    name: "Nike Men's Free 5.0+ Running Shoe",
    shortName: "Running Shoe",
    model: "ARIMA",
    leadTime: 5,
  },
  {
    key: "life_vest",
    name: "O'Brien Men's Neoprene Life Vest",
    shortName: "Life Vest",
    model: "XGBoost",
    leadTime: 7,
  },
];

export const PRODUCT_MAP: Record<ProductKey, Product> = {
  golf_polo: PRODUCTS[0],
  running_shoe: PRODUCTS[1],
  life_vest: PRODUCTS[2],
};

export const SERVICE_LEVELS = [90, 95, 99] as const;

export const STATUS_CONFIG = {
  normal: { label: "Normal", color: "text-green-700 bg-green-50 border-green-200" },
  reorder: { label: "Reorder Required", color: "text-amber-700 bg-amber-50 border-amber-200" },
  critical: { label: "Critical", color: "text-red-700 bg-red-50 border-red-200" },
};

export const PRODUCT_COLORS: Record<ProductKey, string> = {
  golf_polo: "#3b5998",
  running_shoe: "#8b9dc3",
  life_vest: "#2f4779",
};

export const MAX_LEAD_TIME = 7;
export const LOCAL_STORAGE_KEY = "dss_inventory_state_v2";
