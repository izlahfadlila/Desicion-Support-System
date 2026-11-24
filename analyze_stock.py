import pandas as pd
import numpy as np

df = pd.read_csv('daily_sales_selected3_2024_2026.csv', parse_dates=['Order Date'])
df = df.sort_values('Order Date')

products = {
    'Golf Polo': "Nike Men's Dri-FIT Victory Golf Polo",
    'Running Shoe': "Nike Men's Free 5.0+ Running Shoe",
    'Life Vest': "O'Brien Men's Neoprene Life Vest"
}

lead_times = {'Golf Polo': 5, 'Running Shoe': 5, 'Life Vest': 7}

print('=== ANALISIS DEMAND 90 HARI TERAKHIR (Jul-Sep 2026) ===')
last90 = df[df['Order Date'] >= '2026-07-01']

for name, col in products.items():
    d = last90[col]
    lt = lead_times[name]
    print(f'\n{name}:')
    print(f'  Mean harian (90 hari terakhir) : {d.mean():.2f}')
    print(f'  Median                          : {d.median():.2f}')
    print(f'  Std                             : {d.std():.2f}')
    print(f'  Min / Max                       : {d.min():.0f} / {d.max():.0f}')
    print(f'  Total 90 hari                   : {d.sum():.0f}')
    print(f'  Lead time                       : {lt} hari')
    print(f'  Avg demand selama lead time     : {d.mean() * lt:.1f}')
    q90 = d.quantile(0.90)
    print(f'  P90 harian                      : {q90:.2f}')
    print(f'  P90 x lead time (est. safety buffer) : {q90 * lt:.1f}')

print('\n=== DEMAND BULAN SEPTEMBER 2026 (detail per tanggal) ===')
sep = df[df['Order Date'] >= '2026-09-01']
for name, col in products.items():
    d = sep[col]
    print(f'\n{name}: Mean={d.mean():.2f}, Std={d.std():.2f}, Total Sep={d.sum():.0f}')

print('\n=== 15 HARI TERAKHIR (16-30 Sep 2026) ===')
last15 = df[df['Order Date'] >= '2026-09-16']
for name, col in products.items():
    d = last15[col]
    print(f'{name}: Mean={d.mean():.2f}, Total={d.sum():.0f}')

print('\n=== LEAD TIME UNCERTAINTY (dari file output model) ===')
try:
    lt_unc = pd.read_csv('forecast_outputs/lead_time_uncertainty.csv')
    print(lt_unc.to_string())
except Exception as e:
    print(f'Error: {e}')
