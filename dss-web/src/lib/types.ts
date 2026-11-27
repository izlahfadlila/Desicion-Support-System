// ============================================================
// All TypeScript types for the DSS Inventory system
// ============================================================

export type ProductKey = "golf_polo" | "running_shoe" | "life_vest";
export type ServiceLevel = 90 | 95 | 99;
export type Role = "user" | "admin";
export type OrderStatus = "pending" | "arrived";
export type TransactionType = "SALES" | "GOODS_RECEIPT" | "NEW_PO" | "ORDER_PLACED" | "INITIAL_SETUP" | "ADJUSTMENT" | "STOCKOUT";

export interface Product {
  key: ProductKey;
  name: string;
  shortName: string;
  model: string;
  leadTime: number; // calendar days
}

export interface PurchaseOrder {
  orderId: string;
  productKey: ProductKey;
  quantity: number;
  orderDate: string; // ISO date string
  expectedArrival: string; // ISO date string
  status: OrderStatus;
}

export interface Transaction {
  id: string;
  date: string;
  productKey: ProductKey;
  type: TransactionType;
  quantity: number;
  description: string;
}

export interface ProductInventory {
  productKey: ProductKey;
  currentStock: number;
  backorders: number;
}

export interface SystemState {
  isInitialized: boolean;
  currentDate: string; // "YYYY-MM-DD"
  inventory: Record<ProductKey, ProductInventory>;
  purchaseOrders: PurchaseOrder[];
  transactions: Transaction[];
  initialSnapshot: {
    inventory: Record<ProductKey, ProductInventory>;
    purchaseOrders: PurchaseOrder[];
  } | null;
}

export interface OUTLResult {
  productKey: ProductKey;
  leadTime: number;
  serviceLevel: ServiceLevel;
  dailyForecast: number;
  ltdForecast: number; // Lead Time Demand
  safetyStock: number; // Dynamic Safety Stock
  targetStock: number; // S = LTD + SS
  currentStock: number;
  onOrder: number;
  backorders: number;
  inventoryPosition: number; // IP = CS + OO - BO
  orderQuantity: number; // Q = max(0, S - IP)
  status: "normal" | "reorder" | "critical";
}

export interface SensitivityRow {
  serviceLevel: ServiceLevel;
  safetyStock: number;
  targetStock: number;
  orderQuantity: number;
}

// ---- Forecasting data types ----
export interface LeadTimeUncertaintyRow {
  product: ProductKey;
  leadTime: number;
  meanError: number;
  errorStd: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface ModelEvaluationRow {
  product: ProductKey;
  horizon: string;
  model: string;
  mae: number;
  rmse: number;
  wape: number;
  bias: number;
}

export interface BestModelRow {
  product: ProductKey;
  horizon: string;
  model: string;
  validationMae: number;
  validationRmse: number;
  validationWape: number;
  validationBias: number;
}

export interface ForecastPoint {
  product: ProductKey;
  forecastDate: string;
  horizon: string;
  model: string;
  forecastDemand: number;
  forecastDemandRounded: number;
}

export interface MonthlyDemandPoint {
  yearMonth: string;
  golfPolo: number;
  runningShoe: number;
  lifeVest: number;
}
