import pandas as pd

# Membaca dataset
df = pd.read_csv("orders_and_shipments.csv")

# Menghilangkan spasi berlebih pada nama kolom
df.columns = df.columns.str.strip()
df["Order Date"] = pd.to_datetime({
    "year": df["Order Year"],
    "month": df["Order Month"],
    "day": df["Order Day"]
})

# Mengurutkan data berdasarkan tanggal
df = df.sort_values("Order Date")

# Melihat rentang tanggal
print("Tanggal awal:", df["Order Date"].min())
print("Tanggal akhir:", df["Order Date"].max())# Membuat daftar seluruh tanggal dari awal sampai akhir data
all_dates = pd.date_range(
    start=df["Order Date"].min(),
    end=df["Order Date"].max(),
    freq="D"
)

# Mengambil tanggal unik yang memiliki transaksi
existing_dates = pd.DatetimeIndex(df["Order Date"].unique())

# Mencari tanggal yang tidak memiliki transaksi
missing_dates = all_dates.difference(existing_dates)

print("Total hari dalam periode:", len(all_dates))
print("Total hari dengan transaksi:", len(existing_dates))
print("Total hari tanpa transaksi:", len(missing_dates))

print("\nTanggal yang tidak memiliki transaksi:")
print(missing_dates)

# Menghitung total quantity setiap produk
top_products = (
    df.groupby("Product Name")["Order Quantity"]
    .sum()
    .sort_values(ascending=False)
    .head(3)
)

print("3 Produk dengan Penjualan Terbanyak:")
print(top_products)


# Mengambil nama 3 produk terlaris
top_3_products = top_products.index

# Memfilter data
df_top3 = df[df["Product Name"].isin(top_3_products)].copy()

# Mengurutkan berdasarkan tanggal dan produk
df_top3 = df_top3.sort_values(["Product Name", "Order Date"])

print(df_top3.head())

print("\nJumlah baris data:", len(df_top3))
print("\nProduk yang digunakan:")
print(df_top3["Product Name"].unique())


# Menggabungkan transaksi berdasarkan tanggal dan produk
daily_sales = (
    df_top3.groupby(["Order Date", "Product Name"])["Order Quantity"]
    .sum()
    .reset_index()
)

# Mengubah menjadi format tabel:
# Baris = tanggal, kolom = produk
daily_sales_pivot = daily_sales.pivot(
    index="Order Date",
    columns="Product Name",
    values="Order Quantity"
)

# Melengkapi seluruh tanggal yang tidak ada
daily_sales_pivot = daily_sales_pivot.reindex(all_dates)

# Mengisi tanggal tanpa transaksi dengan 0
daily_sales_pivot = daily_sales_pivot.fillna(0)

# Mengembalikan tanggal menjadi kolom biasa
daily_sales_pivot = daily_sales_pivot.reset_index()
daily_sales_pivot = daily_sales_pivot.rename(columns={"index": "Order Date"})

print(daily_sales_pivot.head(10))


daily_sales_pivot.to_csv("daily_sales_top3.csv", index=False)