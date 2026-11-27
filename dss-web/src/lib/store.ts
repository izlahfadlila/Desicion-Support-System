// ============================================================
// State Management with Hybrid Cloud (Upstash Redis) + LocalStorage
// ============================================================

import type { SystemState, ProductKey, PurchaseOrder, Transaction, ProductInventory } from "./types";
import { LOCAL_STORAGE_KEY, SYSTEM_START_DATE } from "./constants";
import { INITIAL_DEMO_STATE } from "../data/initialDemoState";
import { SEPTEMBER_ACTUAL_SALES } from "../data/septemberActuals";

function cloneInitialState(): SystemState {
  return JSON.parse(JSON.stringify(INITIAL_DEMO_STATE)) as SystemState;
}

export function loadState(): SystemState {
  if (typeof window === "undefined") return cloneInitialState();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SystemState;
      // If previous version was on Oct 1, upgrade to Sep 26 demo state
      if (parsed.currentDate >= "2026-09-26" && parsed.currentDate <= "2026-09-30") {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  const fresh = cloneInitialState();
  saveState(fresh);
  return fresh;
}

// Background async cloud sync
export function syncFromCloud(onLoaded?: (state: SystemState) => void): void {
  if (typeof window === "undefined") return;
  fetch("/api/state")
    .then((res) => res.json())
    .then((data) => {
      if (data?.state) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data.state));
        if (onLoaded) onLoaded(data.state);
        window.dispatchEvent(new Event("dss_state_changed"));
      }
    })
    .catch((err) => {
      console.warn("Could not sync from cloud, using local state:", err);
    });
}

export function saveState(state: SystemState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));

  // Sync to Upstash Redis in background
  fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  }).catch(() => {
    // offline fallback
  });
}

export function resetState(): SystemState {
  const fresh = cloneInitialState();
  saveState(fresh);

  fetch("/api/state", { method: "DELETE" }).catch(() => {});
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

// ---- Simulate Next Day (Automated fulfillment from actual dataset + EOD arrival) ----
export function simulateNextDay(state: SystemState): SystemState {
  const nextDate = advanceDate(state.currentDate);
  const products: ProductKey[] = ["golf_polo", "running_shoe", "life_vest"];

  const newState: SystemState = {
    ...state,
    currentDate: nextDate,
    inventory: { ...state.inventory },
    purchaseOrders: [...state.purchaseOrders],
    transactions: [...state.transactions],
  };

  const actualSalesToday = SEPTEMBER_ACTUAL_SALES[state.currentDate] ?? {
    golf_polo: 0,
    running_shoe: 0,
    life_vest: 0,
  };

  for (const productKey of products) {
    const inv = { ...newState.inventory[productKey] };
    const txBase = { date: state.currentDate, productKey };

    // 1. Demand Fulfillment during current date
    const demand = actualSalesToday[productKey] ?? 0;
    const fulfilled = Math.min(demand, inv.currentStock);
    const unmet = demand - fulfilled;
    inv.currentStock -= fulfilled;

    if (fulfilled > 0) {
      newState.transactions.push({
        id: `TXN-${state.currentDate}-SALES-${productKey}`,
        ...txBase,
        type: "SALES",
        quantity: fulfilled,
        description: `Actual Sales: ${fulfilled} units fulfilled`,
      });
    }

    if (unmet > 0) {
      newState.transactions.push({
        id: `TXN-${state.currentDate}-STOCKOUT-${productKey}`,
        ...txBase,
        type: "STOCKOUT",
        quantity: unmet,
        description: `Stockout: ${unmet} units unmet (lost sales)`,
      });
    }

    // 2. End-of-Day (EOD) Goods Receipt -> processed evening, ready for nextDate (t+1)
    const arrivingOrders = newState.purchaseOrders.filter(
      (po) =>
        po.productKey === productKey &&
        po.status === "pending" &&
        po.expectedArrival <= state.currentDate
    );

    for (const po of arrivingOrders) {
      inv.currentStock += po.quantity;
      newState.purchaseOrders = newState.purchaseOrders.map((p) =>
        p.orderId === po.orderId ? { ...p, status: "arrived" as const } : p
      );
      newState.transactions.push({
        id: `TXN-${state.currentDate}-RCV-${po.orderId}`,
        ...txBase,
        type: "GOODS_RECEIPT",
        quantity: po.quantity,
        description: `Goods received (EOD) from ${po.orderId} (+${po.quantity} ready for ${nextDate})`,
      });
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
  leadTime: number
): SystemState {
  const arrivalDate = addDays(state.currentDate, leadTime);
  const orderId = `PO-2026-DEMO-${String(state.purchaseOrders.length + 1).padStart(3, "0")}`;

  const newPO: PurchaseOrder = {
    orderId,
    productKey,
    quantity,
    orderDate: state.currentDate,
    expectedArrival: arrivalDate,
    status: "pending",
  };

  const newTx: Transaction = {
    id: `TXN-${Date.now()}-${orderId}`,
    date: state.currentDate,
    productKey,
    type: "NEW_PO",
    quantity,
    description: `Order placed: ${quantity} units (expected: ${arrivalDate})`,
  };

  const newState: SystemState = {
    ...state,
    purchaseOrders: [...state.purchaseOrders, newPO],
    transactions: [...state.transactions, newTx],
  };

  saveState(newState);
  return newState;
}

// ---- Date utilities ----
export function advanceDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const [year, month, day] = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatDateLong(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
