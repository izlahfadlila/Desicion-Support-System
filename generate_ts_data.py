import json
from pathlib import Path
import pandas as pd

base = Path(__file__).resolve().parent
out_dir = base / "forecast_outputs"
dss_data_dir = base / "dss-web" / "src" / "data"

# 1. Benchmark Data
with open(out_dir / "evaluation_benchmark_data.json", encoding="utf-8") as f:
    bench = json.load(f)

with open(dss_data_dir / "benchmarkData.ts", "w", encoding="utf-8") as f:
    f.write("// Auto-generated from forecast_outputs/evaluation_benchmark_data.json\n")
    f.write("export const EVALUATION_BENCHMARK = " + json.dumps(bench, indent=2) + ";\n")

# 2. Initial Demo State (2026-09-26)
with open(out_dir / "initial_demo_state.json", encoding="utf-8") as f:
    demo = json.load(f)

with open(dss_data_dir / "initialDemoState.ts", "w", encoding="utf-8") as f:
    f.write('import type { SystemState } from "../lib/types";\n\n')
    f.write("// Auto-generated snapshot at 2026-09-26 from 1-25 Sep evaluation backtest\n")
    f.write("export const INITIAL_DEMO_STATE: SystemState = " + json.dumps(demo, indent=2) + ";\n")

# 3. September Daily Actuals
sep_df = pd.read_csv(out_dir / "september_actuals.csv")
sep_actuals_dict = {}
for _, row in sep_df.iterrows():
    d_str = str(row["Date"])[:10]
    sep_actuals_dict[d_str] = {
        "golf_polo": int(round(float(row["Nike Men's Dri-FIT Victory Golf Polo"]))),
        "running_shoe": int(round(float(row["Nike Men's Free 5.0+ Running Shoe"]))),
        "life_vest": int(round(float(row["O'Brien Men's Neoprene Life Vest"]))),
    }

with open(dss_data_dir / "septemberActuals.ts", "w", encoding="utf-8") as f:
    f.write('import type { ProductKey } from "../lib/types";\n\n')
    f.write("// Ground truth daily sales for September 2026\n")
    f.write("export const SEPTEMBER_ACTUAL_SALES: Record<string, Record<ProductKey, number>> = " + json.dumps(sep_actuals_dict, indent=2) + ";\n")

# 4. September Rolling Forecasts H+1..H+7
roll_df = pd.read_csv(out_dir / "september_rolling_forecasts.csv")
roll_dict = {}
for _, row in roll_df.iterrows():
    p = row["Product"]
    pk = "golf_polo" if "Golf Polo" in p else "running_shoe" if "Running Shoe" in p else "life_vest"
    orig = str(row["Origin Date"])
    h = int(str(row["Horizon"]).replace("H+", ""))
    val = float(row["Forecast Demand"])
    if pk not in roll_dict:
        roll_dict[pk] = {}
    if orig not in roll_dict[pk]:
        roll_dict[pk][orig] = {}
    roll_dict[pk][orig][h] = round(val, 2)

with open(dss_data_dir / "rollingForecasts.ts", "w", encoding="utf-8") as f:
    f.write('import type { ProductKey } from "../lib/types";\n\n')
    f.write("// Rolling forecasts H+1..H+7 by product and origin date (day before decision)\n")
    f.write("export const ROLLING_FORECASTS: Record<ProductKey, Record<string, Record<number, number>>> = " + json.dumps(roll_dict, indent=2) + ";\n")

print("All TypeScript data files generated successfully in dss-web/src/data/")
