# DSS Inventory Replenishment — Panduan Menjalankan

> **Intelligent Inventory Replenishment Decision Support System**  
> Next.js 14 · TypeScript · Tailwind CSS · Recharts · Deploy ke Vercel

---

## Prasyarat

Pastikan sudah terinstall di laptop kamu:
- **Node.js** versi 18 atau lebih baru → cek dengan `node -v`
- **npm** (sudah bundled bersama Node.js) → cek dengan `npm -v`

Kalau belum ada Node.js, download di: https://nodejs.org

---

## Cara Menjalankan di Localhost (Dev Mode)

Buka terminal / PowerShell, lalu jalankan perintah-perintah ini **satu per satu**:

```bash
# 1. Masuk ke folder project web
cd "e:\UNS\SEMESTER 7\Desicion Support System\Project\Intelligence Inventory Replenishment\dss-web"

# 2. Install dependencies (hanya perlu sekali)
npm install

# 3. Jalankan dev server
npm run dev
```

Setelah `npm run dev` berjalan, buka browser dan akses:
```
http://localhost:3000
```

Tekan **Ctrl+C** di terminal untuk menghentikan server.

---

## Cara Deploy ke Vercel (Gratis, Link Online Permanen)

### Langkah 1 — Upload ke GitHub
```bash
# Di folder dss-web, inisialisasi git (kalau belum)
git init
git add .
git commit -m "Initial DSS Inventory Replenishment"

# Buat repo baru di github.com lalu push
git remote add origin https://github.com/USERNAME/dss-inventory.git
git push -u origin main
```

### Langkah 2 — Deploy ke Vercel
1. Buka https://vercel.com dan login (pakai akun GitHub)
2. Klik **"New Project"**
3. Pilih repository `dss-inventory`
4. Klik **Deploy** — selesai!

Vercel akan memberikan link permanen seperti:
```
https://dss-inventory-xxxx.vercel.app
```

> **Catatan:** State inventory (stok, PO, transaksi) tersimpan di LocalStorage browser.
> Setiap perangkat/browser akan memiliki state tersendiri — cocok untuk presentasi demo.

---

## Struktur Halaman & Cara Pakai

### Role User (Manager)
Akses via tombol **"👤 User"** di pojok kanan atas navbar.

| Halaman | URL | Fungsi |
|---|---|---|
| Dashboard | `/dashboard` | Pantau kondisi stok, incoming orders, & ringkasan rekomendasi |
| Inventory Decision | `/inventory-decision` | Generate rekomendasi order dengan kalkulator OUTL+DSS |

### Role Admin (Developer)
Akses via tombol **"⚙ Admin"** di pojok kanan atas navbar.

| Halaman | URL | Fungsi |
|---|---|---|
| Forecasting Management | `/forecasting-management` | Lihat perbandingan 4 model, error distribution, safety stock |
| System Configuration | `/system-configuration` | Setup stok awal, simulasi harian, log transaksi |

---

## Alur Demo untuk Presentasi

### Setup Awal (Admin)
1. Buka **System Configuration → Initial Inventory Setup**
2. Konfirmasi stok awal sudah terisi (default: Golf Polo=50, Running Shoe=25, Life Vest=60)
3. Konfirmasi 3 initial PO sudah tercatat:
   - `PO-2026-001` Life Vest 50u → tiba 1 Okt
   - `PO-2026-002` Golf Polo 40u → tiba 2 Okt
   - `PO-2026-003` Running Shoe 20u → tiba 4 Okt
4. Klik **Save Initial Inventory**

### Demo Utama (User)
1. Switch ke role **User**
2. Buka **Dashboard** → tunjukkan:
   - Golf Polo status 🔴 REORDER (IP < Target)
   - Running Shoe & Life Vest status 🟢 Normal
   - Tabel Upcoming Incoming Orders (Life Vest tiba hari ini!)
3. Klik **"View Decision"** pada Golf Polo
4. Di **Inventory Decision**:
   - Lead time default: 5 hari
   - Service level: pilih 95%
   - Klik **"Generate Recommendation"**
   - Tunjukkan: LTD, Dynamic Safety Stock, Target Stock, Order Qty
   - Expand **Sensitivity Analysis** → tunjukkan perbedaan 90%/95%/99%
5. Klik **"Place Order"** → Confirm → kembali ke Dashboard

### Demo Simulasi Harian (Admin)
1. Switch ke role **Admin**
2. Buka **System Configuration → Daily Simulation**
3. Masukkan penjualan hari ini (contoh: Golf Polo=8, Running Shoe=4, Life Vest=12)
4. Klik **"Advance to Next Day"**
5. Tunjukkan:
   - Tanggal sistem bergerak +1 hari
   - Life Vest PO tiba otomatis (stok bertambah 50)
   - Log transaksi terupdate di tab Transaction Log
6. Kembali ke **Dashboard (User)** → tunjukkan perubahan stok real-time

### Reset Sebelum Presentasi
1. Admin → System Configuration
2. Klik **"Reset System"** → Confirm
3. Semua data kembali ke kondisi awal 1 Oktober 2026

---

## Data yang Digunakan

Semua data berasal dari hasil notebook forecasting yang sudah selesai:

| File Output | Digunakan untuk |
|---|---|
| `forecast_outputs/best_models.csv` | Model terpilih per produk |
| `forecast_outputs/model_evaluation.csv` | Tabel perbandingan 4 model (MAE, RMSE, WAPE, Bias) |
| `forecast_outputs/lead_time_uncertainty.csv` | Dynamic Safety Stock (P90/P95/P99) |
| `forecast_outputs/final_forecasts.csv` | Nilai forecast H+1, H+3, H+7 |
| `forecast_outputs/demand_history.csv` | Grafik demand historis |

Semua data di atas sudah di-*embed* langsung ke dalam file `src/data/forecastData.ts`
— tidak perlu Python backend untuk membacanya.

---

## Logika DSS yang Diimplementasikan

Semua kalkulasi berjalan di TypeScript (`src/lib/calculations.ts`):

```
LTD  = H+1 Forecast/day × Lead Time
SS   = max(0, Qα(E_LT))   ← dari tabel lead_time_uncertainty
S    = LTD + SS
IP   = Current Stock + On-Order - Backorders
Q    = max(0, S - IP)
```

---

## File Struktur Proyek

```
dss-web/
├── src/
│   ├── app/
│   │   ├── dashboard/page.tsx          ← Halaman Dashboard (User)
│   │   ├── inventory-decision/page.tsx ← Halaman OUTL Calculator (User)
│   │   ├── forecasting-management/page.tsx  ← Model Comparison (Admin)
│   │   ├── system-configuration/page.tsx    ← Daily Sim + Setup (Admin)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── AppLayout.tsx               ← Sidebar + Navbar + Role Switcher
│   ├── data/
│   │   └── forecastData.ts             ← Semua data output model (embedded)
│   └── lib/
│       ├── types.ts                    ← TypeScript type definitions
│       ├── constants.ts                ← Produk, warna, konfigurasi
│       ├── calculations.ts             ← OUTL + Dynamic Safety Stock engine
│       └── store.ts                    ← LocalStorage state management
├── package.json
├── tailwind.config.js
└── tsconfig.json
```
