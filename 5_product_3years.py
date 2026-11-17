
import pandas as pd

# 1. Membaca dataset
df = pd.read_csv("orders_and_shipments.csv")

# 2. Membersihkan nama kolom
df.columns = df.columns.str.strip()

# 3. Membuat kolom Order Date
df["Order Date"] = pd.to_datetime({
    "year": df["Order Year"],
    "month": df["Order Month"],
    "day": df["Order Day"]
})

# 4. Membatasi data sumber sampai 30 September 2017
df = df[df["Order Date"] <= "2017-09-30"].copy()

# 5. Menghapus data tanggal 29 Februari 2016
df = df[
    ~(
        (df["Order Date"].dt.year == 2016) &
        (df["Order Date"].dt.month == 2) &
        (df["Order Date"].dt.day == 29)
    )
].copy()

# 6. Mengubah tahun
year_mapping = {
    2015: 2024,
    2016: 2025,
    2017: 2026
}

df["Order Date"] = df["Order Date"].apply(
    lambda date: date.replace(year=year_mapping[date.year])
)

# 7. Memilih tiga produk
selected_products = [
    "Nike Men's Dri-FIT Victory Golf Polo",
    "O'Brien Men's Neoprene Life Vest",
    "Nike Men's Free 5.0+ Running Shoe"
]

df_selected = df[
    df["Product Name"].isin(selected_products)
].copy()

# 8. Mengagregasikan Order Quantity berdasarkan tanggal dan produk
daily_sales = (
    df_selected
    .groupby(["Order Date", "Product Name"])["Order Quantity"]
    .sum()
    .reset_index()
)

# 9. Mengubah data menjadi format kolom per produk
daily_sales_pivot = daily_sales.pivot(
    index="Order Date",
    columns="Product Name",
    values="Order Quantity"
)

# 10. Membuat rentang tanggal lengkap
all_dates = pd.date_range(
    start="2024-01-01",
    end="2026-09-30",
    freq="D"
)

# 11. Mengisi tanggal yang tidak memiliki transaksi dengan 0
daily_sales_pivot = daily_sales_pivot.reindex(all_dates)
daily_sales_pivot = daily_sales_pivot.fillna(0)

# 12. Mengatur nama index dan mengubahnya menjadi kolom
daily_sales_pivot.index.name = "Order Date"
daily_sales_pivot = daily_sales_pivot.reset_index()

# 13. Memastikan urutan kolom
daily_sales_pivot = daily_sales_pivot[
    ["Order Date"] + selected_products
]

# 14. Menyimpan hasil (nama file tetap sama)
daily_sales_pivot.to_csv(
    "daily_sales_selected3_2024_2026.csv",
    index=False
)

# 15. Menampilkan hasil pengecekan
print("Data berhasil diproses!")
print("Jumlah baris:", len(daily_sales_pivot))
print("Tanggal awal:", daily_sales_pivot["Order Date"].min())
print("Tanggal akhir:", daily_sales_pivot["Order Date"].max())

print("\nTotal penjualan setiap produk:")
print(daily_sales_pivot[selected_products].sum())

print("\nPreview data:")
print(daily_sales_pivot.head())
