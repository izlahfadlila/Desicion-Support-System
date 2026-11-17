
import pandas as pd

# 1. Membaca dataset
df = pd.read_csv("orders_and_shipments.csv")

# Menghilangkan spasi berlebih pada nama kolom
df.columns = df.columns.str.strip()


# 2. Menggabungkan kolom tanggal
df["Order Date"] = pd.to_datetime({
    "year": df["Order Year"],
    "month": df["Order Month"],
    "day": df["Order Day"]
})

# Mengurutkan data berdasarkan tanggal
df = df.sort_values("Order Date")

# Melihat rentang tanggal
print("Tanggal awal:", df["Order Date"].min())
print("Tanggal akhir:", df["Order Date"].max())


# 3. Mengecek tanggal yang tidak memiliki transaksi

# Membuat daftar seluruh tanggal dari awal sampai akhir data
all_dates = pd.date_range(
    start=df["Order Date"].min(),
    end=df["Order Date"].max(),
    freq="D"
)

# Mengambil tanggal unik yang memiliki transaksi
existing_dates = pd.DatetimeIndex(df["Order Date"].unique())

# Mencari tanggal yang tidak memiliki transaksi
missing_dates = all_dates.difference(existing_dates)

print("\nTotal hari dalam periode:", len(all_dates))
print("Total hari dengan transaksi:", len(existing_dates))
print("Total hari tanpa transaksi:", len(missing_dates))

print("\nTanggal yang tidak memiliki transaksi:")
print(missing_dates)


# 4. Menentukan 3 produk yang akan digunakan

selected_products = [
    "Nike Men's Dri-FIT Victory Golf Polo",
    "O'Brien Men's Neoprene Life Vest",
    "Nike Men's Free 5.0+ Running Shoe"
]

# Melihat total quantity masing-masing produk
print("\nTotal penjualan produk yang dipilih:")
print(
    df[df["Product Name"].isin(selected_products)]
    .groupby("Product Name")["Order Quantity"]
    .sum()
)


# 5. Memfilter dataset hanya untuk 3 produk tersebut

df_selected = df[
    df["Product Name"].isin(selected_products)
].copy()

# Mengurutkan berdasarkan tanggal dan produk
df_selected = df_selected.sort_values(
    ["Product Name", "Order Date"]
)

print("\nJumlah baris data:", len(df_selected))
print("\nProduk yang digunakan:")
print(df_selected["Product Name"].unique())


# 6. Membuat agregasi penjualan harian untuk 3 produk

# Menggabungkan transaksi berdasarkan tanggal dan produk
daily_sales = (
    df_selected.groupby(["Order Date", "Product Name"])["Order Quantity"]
    .sum()
    .reset_index()
)

# Mengubah menjadi format tabel
daily_sales_pivot = daily_sales.pivot(
    index="Order Date",
    columns="Product Name",
    values="Order Quantity"
)

# Melengkapi seluruh tanggal
daily_sales_pivot = daily_sales_pivot.reindex(all_dates)

# Mengisi tanggal tanpa transaksi dengan 0
daily_sales_pivot = daily_sales_pivot.fillna(0)

# Mengembalikan tanggal menjadi kolom biasa
daily_sales_pivot = daily_sales_pivot.reset_index()
daily_sales_pivot = daily_sales_pivot.rename(
    columns={"index": "Order Date"}
)

print("\nData penjualan harian 3 produk:")
print(daily_sales_pivot.head(10))


# 7. Menyimpan hasil ke CSV baru

daily_sales_pivot.to_csv(
    "daily_sales_selected3.csv",
    index=False
)

print("\nData berhasil disimpan sebagai daily_sales_selected3.csv")
