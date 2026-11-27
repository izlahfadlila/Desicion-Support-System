"""
Fase 1: Automated Backtesting & Evaluation Simulation (Sep 1 - Sep 25, 2026)
- Compares DSS (ML Rolling Forecasts + Dynamic Safety Stock) vs
  Traditional Baseline (Historical Mean LTD + Z * sigma_d * sqrt(L))
- Uses End-of-Day (EOD) delivery logic
- Tests Service Levels: 90%, 95%, 99%
- Generates evaluation_benchmark_data.json and initial_demo_state.json (snapshot at 2026-09-26)
"""

import json
import math
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = BASE_DIR / "forecast_outputs"

PRODUCTS = [
    {
        "key": "golf_polo",
        "name": "Nike Men's Dri-FIT Victory Golf Polo",
        "shortName": "Golf Polo",
        "leadTime": 5,
    },
    {
        "key": "running_shoe",
        "name": "Nike Men's Free 5.0+ Running Shoe",
        "shortName": "Running Shoe",
        "leadTime": 5,
    },
    {
        "key": "life_vest",
        "name": "O'Brien Men's Neoprene Life Vest",
        "shortName": "Life Vest",
        "leadTime": 7,
    },
]

Z_SCORES = {
    90: 1.2816,
    95: 1.6449,
    99: 2.3263,
}

# Load datasets
hist_df = pd.read_csv(OUT_DIR / "demand_history.csv", parse_dates=["Date"]).set_index("Date")
sep_actuals_df = pd.read_csv(OUT_DIR / "september_actuals.csv", parse_dates=["Date"]).set_index("Date")
rolling_df = pd.read_csv(OUT_DIR / "september_rolling_forecasts.csv")
lt_unc_df = pd.read_csv(OUT_DIR / "lead_time_uncertainty.csv")

# Build lookup maps
# rolling_map[(product_name, origin_date_str, horizon_int)] = forecast_demand
rolling_map = {}
for _, row in rolling_df.iterrows():
    h = int(str(row["Horizon"]).replace("H+", ""))
    rolling_map[(row["Product"], row["Origin Date"], h)] = float(row["Forecast Demand"])

# lt_unc_map[(product_name, lead_time)] = {p90, p95, p99}
lt_unc_map = {}
for _, row in lt_unc_df.iterrows():
    lt_unc_map[(row["Product"], int(row["Lead Time"]))] = {
        90: max(0.0, float(row["Error P90"])),
        95: max(0.0, float(row["Error P95"])),
        99: max(0.0, float(row["Error P99"])),
    }

# Historical stats (Jan 1, 2024 - Aug 31, 2026)
hist_stats = {}
for p in PRODUCTS:
    s = hist_df[p["name"]].dropna()
    mu = float(s.mean())
    sigma = float(s.std(ddof=1))
    hist_stats[p["key"]] = {"mean": mu, "std": sigma}

print("=== Historical Stats (Jan 2024 - Aug 2026) ===")
for p in PRODUCTS:
    st = hist_stats[p["key"]]
    print(f"  {p['shortName']:15s}: mean={st['mean']:.2f}/day, std={st['std']:.2f}")


def get_dss_ltd(product_name: str, date_str: str, lead_time: int) -> float:
    origin_dt = datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=1)
    origin_str = origin_dt.strftime("%Y-%m-%d")
    total = 0.0
    for h in range(1, lead_time + 1):
        total += rolling_map[(product_name, origin_str, h)]
    return total


def get_dss_ss(product_name: str, lead_time: int, sl: int) -> float:
    return lt_unc_map[(product_name, lead_time)][sl]


def get_baseline_ltd(product_key: str, lead_time: int) -> float:
    return hist_stats[product_key]["mean"] * lead_time


def get_baseline_ss(product_key: str, lead_time: int, sl: int) -> float:
    return Z_SCORES[sl] * hist_stats[product_key]["std"] * math.sqrt(lead_time)


def simulate_period(
    mode: str,  # "dss" or "baseline"
    sl: int,
    initial_stock: dict,
    initial_pos: list,
    start_date: str = "2026-09-01",
    end_date: str = "2026-09-25",
    record_logs: bool = False,
    review_period: int = 1,
):
    stock = dict(initial_stock)
    pos = [dict(po) for po in initial_pos]
    po_counter = len(pos) + 1
    transactions = []

    if record_logs:
        for p in PRODUCTS:
            transactions.append({
                "id": f"TXN-INIT-{p['key']}",
                "date": start_date,
                "productKey": p["key"],
                "type": "INITIAL_SETUP",
                "quantity": stock[p["key"]],
                "description": f"Initial stock setup: {stock[p['key']]} units",
            })

    cur_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    day_idx = 0

    # Metrics per product
    metrics = {
        p["key"]: {
            "totalDemand": 0,
            "fulfilledDemand": 0,
            "lostSales": 0,
            "stockoutDays": 0,
            "dailyStocks": [],
            "ordersPlaced": 0,
            "totalOrderedQty": 0,
        }
        for p in PRODUCTS
    }

    while cur_dt <= end_dt:
        d_str = cur_dt.strftime("%Y-%m-%d")
        actual_row = sep_actuals_df.loc[pd.Timestamp(d_str)]

        for p in PRODUCTS:
            pk = p["key"]
            pname = p["name"]
            lt = p["leadTime"]

            # 1. Start-of-Day Decision (on review days)
            on_order = sum(po["quantity"] for po in pos if po["productKey"] == pk and po["status"] == "pending")
            ip = stock[pk] + on_order

            if day_idx % review_period == 0:
                if mode == "dss":
                    ltd = get_dss_ltd(pname, d_str, lt)
                    ss = get_dss_ss(pname, lt, sl)
                else:
                    ltd = get_baseline_ltd(pk, lt)
                    ss = get_baseline_ss(pk, lt, sl)

                target_s = ltd + ss
                order_qty = max(0, math.ceil(target_s - ip))
            else:
                order_qty = 0

            if order_qty > 0:
                arrival_str = (cur_dt + timedelta(days=lt)).strftime("%Y-%m-%d")
                po_id = f"PO-2026-SEP-{po_counter:03d}"
                po_counter += 1
                pos.append({
                    "orderId": po_id,
                    "productKey": pk,
                    "quantity": order_qty,
                    "orderDate": d_str,
                    "expectedArrival": arrival_str,
                    "status": "pending",
                })
                metrics[pk]["ordersPlaced"] += 1
                metrics[pk]["totalOrderedQty"] += order_qty
                if record_logs:
                    transactions.append({
                        "id": f"TXN-{d_str}-{po_id}",
                        "date": d_str,
                        "productKey": pk,
                        "type": "ORDER_PLACED",
                        "quantity": order_qty,
                        "description": f"Automated PO {po_id} placed ({order_qty} units, arrives {arrival_str})",
                    })

            # 2. Intraday Demand Fulfillment
            demand = int(round(float(actual_row[pname])))
            fulfilled = min(demand, stock[pk])
            unmet = demand - fulfilled
            stock[pk] -= fulfilled

            metrics[pk]["totalDemand"] += demand
            metrics[pk]["fulfilledDemand"] += fulfilled
            metrics[pk]["lostSales"] += unmet
            if unmet > 0:
                metrics[pk]["stockoutDays"] += 1

            if record_logs and demand > 0:
                if fulfilled > 0:
                    transactions.append({
                        "id": f"TXN-{d_str}-SALES-{pk}",
                        "date": d_str,
                        "productKey": pk,
                        "type": "SALES",
                        "quantity": fulfilled,
                        "description": f"Sales: {fulfilled} units fulfilled",
                    })
                if unmet > 0:
                    transactions.append({
                        "id": f"TXN-{d_str}-STOCKOUT-{pk}",
                        "date": d_str,
                        "productKey": pk,
                        "type": "STOCKOUT",
                        "quantity": unmet,
                        "description": f"Stockout: {unmet} units unmet (lost sales)",
                    })

            # 3. End-of-Day (EOD) Goods Receipt -> ready for next day (t+1)
            for po in pos:
                if po["productKey"] == pk and po["status"] == "pending" and po["expectedArrival"] <= d_str:
                    po["status"] = "arrived"
                    stock[pk] += po["quantity"]
                    if record_logs:
                        transactions.append({
                            "id": f"TXN-{d_str}-RCV-{po['orderId']}",
                            "date": d_str,
                            "productKey": pk,
                            "type": "GOODS_RECEIPT",
                            "quantity": po["quantity"],
                            "description": f"Goods received (EOD) from {po['orderId']} (ready for next day)",
                        })

            metrics[pk]["dailyStocks"].append(stock[pk])

        cur_dt += timedelta(days=1)
        day_idx += 1

    # Aggregate summary
    total_demand = sum(m["totalDemand"] for m in metrics.values())
    total_fulfilled = sum(m["fulfilledDemand"] for m in metrics.values())
    total_lost = sum(m["lostSales"] for m in metrics.values())
    total_stockout_days = sum(m["stockoutDays"] for m in metrics.values())
    avg_inventory = sum(np.mean(m["dailyStocks"]) for m in metrics.values())
    fill_rate = (total_fulfilled / total_demand * 100.0) if total_demand > 0 else 100.0

    per_product = {}
    for pk, m in metrics.items():
        d = m["totalDemand"]
        per_product[pk] = {
            "totalDemand": d,
            "fulfilledDemand": m["fulfilledDemand"],
            "lostSales": m["lostSales"],
            "stockoutDays": m["stockoutDays"],
            "avgInventory": round(float(np.mean(m["dailyStocks"])), 1),
            "fillRate": round((m["fulfilledDemand"] / d * 100.0) if d > 0 else 100.0, 1),
            "ordersPlaced": m["ordersPlaced"],
        }

    return {
        "summary": {
            "stockoutDays": total_stockout_days,
            "lostSales": total_lost,
            "avgInventory": round(float(avg_inventory), 1),
            "fillRate": round(float(fill_rate), 1),
        },
        "perProduct": per_product,
        "dailyMetrics": metrics,
        "endStock": stock,
        "purchaseOrders": pos,
        "transactions": transactions,
    }


# Calibrated Sept 1 Initial State (realistic operational start)
INIT_STOCK = {"golf_polo": 80, "running_shoe": 45, "life_vest": 100}
INIT_POS = [
    {
        "orderId": "PO-2026-AUG-001",
        "productKey": "golf_polo",
        "quantity": 30,
        "orderDate": "2026-08-29",
        "expectedArrival": "2026-09-03",
        "status": "pending",
    },
    {
        "orderId": "PO-2026-AUG-002",
        "productKey": "life_vest",
        "quantity": 40,
        "orderDate": "2026-08-28",
        "expectedArrival": "2026-09-04",
        "status": "pending",
    },
]

by_sl = {}
dss_95_full = None
base_95_full = None

print("\n=== Evaluation Results (Sep 1 - Sep 25, 2026) ===")
for sl in [90, 95, 99]:
    res_d = simulate_period("dss", sl, INIT_STOCK, INIT_POS, "2026-09-01", "2026-09-25", record_logs=(sl == 95), review_period=1)
    res_b = simulate_period("baseline", sl, INIT_STOCK, INIT_POS, "2026-09-01", "2026-09-25", record_logs=False, review_period=1)
    by_sl[str(sl)] = {
        "dss": {"summary": res_d["summary"], "perProduct": res_d["perProduct"]},
        "baseline": {"summary": res_b["summary"], "perProduct": res_b["perProduct"]},
    }
    if sl == 95:
        dss_95_full = res_d
        base_95_full = res_b
    print(f"SL={sl}% | DSS={res_d['summary']} | BASE={res_b['summary']}")

# Build daily trajectory for SL=95%
dates_25 = pd.date_range("2026-09-01", "2026-09-25", freq="D")
trajectory = []
for idx, dt in enumerate(dates_25):
    dss_tot = sum(dss_95_full["dailyMetrics"][p["key"]]["dailyStocks"][idx] for p in PRODUCTS)
    base_tot = sum(base_95_full["dailyMetrics"][p["key"]]["dailyStocks"][idx] for p in PRODUCTS)
    trajectory.append({
        "date": dt.strftime("%Y-%m-%d"),
        "dssStock": int(dss_tot),
        "baselineStock": int(base_tot),
    })

benchmark_output = {
    "period": "2026-09-01 to 2026-09-25",
    "days": 25,
    "historicalStats": {
        pk: {"mean": round(v["mean"], 2), "std": round(v["std"], 2)}
        for pk, v in hist_stats.items()
    },
    "zScores": {str(k): v for k, v in Z_SCORES.items()},
    "byServiceLevel": by_sl,
    "dailyTrajectory": trajectory,
}

with open(OUT_DIR / "evaluation_benchmark_data.json", "w", encoding="utf-8") as f:
    json.dump(benchmark_output, f, indent=2)

# Build Sep 26 Demo Snapshot (continuity from Sep 1-25 at SL=95%)
demo_inventory = {
    p["key"]: {
        "productKey": p["key"],
        "currentStock": int(dss_95_full["endStock"][p["key"]]),
        "backorders": 0,
    }
    for p in PRODUCTS
}

demo_state = {
    "isInitialized": True,
    "currentDate": "2026-09-26",
    "inventory": demo_inventory,
    "purchaseOrders": dss_95_full["purchaseOrders"],
    "transactions": dss_95_full["transactions"],
    "initialSnapshot": {
        "inventory": demo_inventory,
        "purchaseOrders": dss_95_full["purchaseOrders"],
    },
}

with open(OUT_DIR / "initial_demo_state.json", "w", encoding="utf-8") as f:
    json.dump(demo_state, f, indent=2)

print("\nSaved forecast_outputs/evaluation_benchmark_data.json")
print("Saved forecast_outputs/initial_demo_state.json")
print("Sep 26 Demo Stock:", {k: v["currentStock"] for k, v in demo_inventory.items()})
print("Sep 26 Pending POs:", [po for po in dss_95_full["purchaseOrders"] if po["status"] == "pending"])
print("Total Evaluation Transactions:", len(dss_95_full["transactions"]))
