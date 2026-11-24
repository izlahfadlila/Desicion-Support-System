// ============================================================
// LocalStorage State Management
// ============================================================

import type { SystemState, ProductKey, PurchaseOrder, Transaction, ProductInventory } from "./types";
import { LOCAL_STORAGE_KEY, SYSTEM_START_DATE } from "./constants";

// ---- Default Initial State (1 Oct 2026) ----
const DEFAULT_INVENTORY: Record<ProductKey, ProductInventory> = {
  golf_polo: { productKey: "golf_polo", currentStock: 50, backorders: 0 },
  running_shoe: { productKey: "running_shoe", currentStock: 25, backorders: 0 },
  life_vest: { productKey: "life_vest", currentStock: 60, backorders: 0 },
};

const DEFAULT_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    orderId: "PO-2026-001",
    productKey: "life_vest",
    quantity: 50,
    orderDate: "2026-09-24",
    expectedArrival: "2026-10-01",
    status: "pending",
  },
  {
    orderId: "PO-2026-002",
    productKey: "golf_polo",
    quantity: 40,
    orderDate: "2026-09-27",
    expectedArrival: "2026-10-02",
    status: "pending",
  },
  {
    orderId: "PO-2026-003",
    productKey: "running_shoe",
    quantity: 20,
    orderDate: "2026-09-29",
    expectedArrival: "2026-10-04",
    status: "pending",
  },
];

function buildInitialState(): SystemState {
  return {
    isInitialized: true,
    currentDate: SYSTEM_START_DATE,
    inventory: { ...DEFAULT_INVENTORY },
    purchaseOrders: DEFAULT_PURCHASE_ORDERS.map((po) => ({ ...po })),
    transactions: [],
    initialSnapshot: {
      inventory: { ...DEFAULT_INVENTORY },
      purchaseOrders: DEFAULT_PURCHASE_ORDERS.map((po) => ({ ...po })),
    },
  };
}

export function loadState(): SystemState {
  if (typeof window === "undefined") return buildInitialState();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SystemState;
  } catch {
    // ignore
  }
  return buildInitialState();
}

export function saveState(state: SystemState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): SystemState {
  const fresh = buildInitialState();
  saveState(fresh);
  return fresh;
}

// ---- Derived helpers ----
export function getOnOrderQty(state: SystemState, productKey: ProductKey): number {
  return state.purchaseOrders
    .filter((po) => po.productKey === productKey && po.status === "pending")
    .reduce((sum, po) => sum + po.quantity, 0);
}

export function getPendingOrders(state: SystemState): PurchaseOrder[] {
  return state.purchaseOrders.filter((po) => po.status === "pending");
}

export function getProductOrders(
  state: SystemState,
  productKey: ProductKey
): PurchaseOrder[] {
  return state.purchaseOrders.filter(
    (po) => po.productKey === productKey && po.status === "pending"
  );
}

// ---- Simulate Next Day ----
export function simulateNextDay(
  state: SystemState,
  salesInput: Record<ProductKey, number>
): SystemState {
  const nextDate = advanceDate(state.currentDate);
  const newState: SystemState = {
    ...state,
    currentDate: nextDate,
    inventory: { ...state.inventory },
    purchaseOrders: [...state.purchaseOrders],
    transactions: [...state.transactions],
  };

  const products: ProductKey[] = ["golf_polo", "running_shoe", "life_vest"];

  for (const productKey of products) {
    const inv = { ...newState.inventory[productKey] };
    const txBase = { date: nextDate, productKey };

    // Step 1: Process goods receipts for this date
    const arrivingOrders = newState.purchaseOrders.filter(
      (po) => po.productKey === productKey &&
               po.status === "pending" &&
               po.expectedArrival <= nextDate
    );

    for (const po of arrivingOrders) {
      inv.currentStock += po.quantity;
      // Mark as arrived
      newState.purchaseOrders = newState.purchaseOrders.map((p) =>
        p.orderId === po.orderId ? { ...p, status: "arrived" as const } : p
      );
      newState.transactions.push({
        id: `TXN-${Date.now()}-${po.orderId}`,
        ...txBase,
        type: "GOODS_RECEIPT",
        quantity: po.quantity,
        description: `Goods received from ${po.orderId}`,
      });
    }

    // Step 2: Fulfill demand
    const sales = salesInput[productKey] ?? 0;
    if (sales > 0) {
      const fulfilled = Math.min(sales, inv.currentStock);
      const unmet = sales - fulfilled;
      inv.currentStock -= fulfilled;

      newState.transactions.push({
        id: `TXN-${Date.now()}-sales-${productKey}`,
        ...txBase,
        type: "SALES",
        quantity: fulfilled,
        description: `Sales: ${fulfilled} units fulfilled`,
      });

      if (unmet > 0) {
        newState.transactions.push({
          id: `TXN-${Date.now()}-stockout-${productKey}`,
          ...txBase,
          type: "STOCKOUT",
          quantity: unmet,
          description: `Stockout: ${unmet} units unmet (lost sales)`,
        });
      }
    }

    newState.inventory[productKey] = inv;
  }

  saveState(newState);
  return newState;
}

// ---- Add Purchase Order ----
export function addPurchaseOrder(
  state: SystemState,
  productKey: ProductKey,
  quantity: number,
  leadTimeDays: number
): SystemState {
  const orderId = `PO-${Date.now()}`;
  const orderDate = state.currentDate;
  const arrival = addDays(orderDate, leadTimeDays);

  const po: PurchaseOrder = {
    orderId,
    productKey,
    quantity,
    orderDate,
    expectedArrival: arrival,
    status: "pending",
  };

  const newState: SystemState = {
    ...state,
    purchaseOrders: [...state.purchaseOrders, po],
    transactions: [
      ...state.transactions,
      {
        id: `TXN-${Date.now()}-po-${productKey}`,
        date: orderDate,
        productKey,
        type: "NEW_PO",
        quantity,
        description: `Purchase Order ${orderId} placed — ${quantity} units, expected ${arrival}`,
      },
    ],
  };

  saveState(newState);
  return newState;
}

// ---- Update Initial Inventory ----
export function updateInitialInventory(
  state: SystemState,
  inventory: Record<ProductKey, ProductInventory>,
  purchaseOrders: PurchaseOrder[]
): SystemState {
  const newState: SystemState = {
    ...state,
    inventory: { ...inventory },
    purchaseOrders: [...purchaseOrders],
    initialSnapshot: {
      inventory: { ...inventory },
      purchaseOrders: [...purchaseOrders],
    },
  };
  saveState(newState);
  return newState;
}

// ---- Date helpers ----
export function advanceDate(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
