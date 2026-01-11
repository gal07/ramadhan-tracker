# 🚀 Panduan Deploy Ramadhan Tracker ke Vercel

## 📋 Checklist Pra-Deploy

- [ ] Code sudah di-push ke GitHub
- [ ] Sudah punya akun Vercel (gratis di [vercel.com](https://vercel.com))

## 🔑 Step 1: Generate NEXTAUTH_SECRET

Pilih salah satu cara:

### Cara 1: Menggunakan OpenSSL (Recommended)
```bash
openssl rand -base64 32
```

### Cara 2: Menggunakan Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Cara 3: Online Generator
Buka: https://generate-secret.vercel.app/32

**Simpan hasil generate ini, akan digunakan di Vercel!**

---

## 🌐 Step 2: Deploy ke Vercel

### 2.1 Import Project
1. Login ke [Vercel Dashboard](https://vercel.com/dashboard)
2. Klik tombol **"Add New..."** → **"Project"**
3. Import repository GitHub kamu
4. Pilih repository `ramadhan-tracker`

### 2.2 Configure Project
1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: `./` (default)
3. **Build Command**: `npm run build` (default)

### 2.3 ⚠️ PENTING: Setup Environment Variables

Sebelum klik Deploy, tambahkan environment variables berikut:

| Key | Value | Note |
|-----|-------|------|
| `NEXTAUTH_URL` | `https://your-app-name.vercel.app` | **Ganti dengan URL deployment kamu** |
| `NEXTAUTH_SECRET` | hasil generate dari step 1 | **Wajib diisi!** |
| `GOOGLE_CLIENT_ID` | (optional) | Jika pakai Google OAuth |
| `GOOGLE_CLIENT_SECRET` | (optional) | Jika pakai Google OAuth |

**Catatan:** Untuk `NEXTAUTH_URL`, kamu bisa:
- Gunakan format: `https://ramadhan-tracker-xxxxx.vercel.app` (akan diberikan Vercel)
- Atau tunggu deploy pertama, lalu update di Settings → Environment Variables

### 2.4 Deploy!
Klik tombol **"Deploy"** dan tunggu proses selesai (± 2-3 menit)

---

## 🔧 Step 3: Update NEXTAUTH_URL (Jika Perlu)

Jika di step 2.3 kamu belum tahu URL deployment:

1. Setelah deploy selesai, copy URL deployment (misal: `https://ramadhan-tracker-abc123.vercel.app`)
2. Buka **Project Settings** → **Environment Variables**
3. Edit `NEXTAUTH_URL` dan ganti dengan URL deployment kamu
4. Klik **Save**
5. Buka tab **Deployments**
6. Klik tombol **"⋯"** pada deployment terakhir → **"Redeploy"**

---

## ✅ Step 4: Test Login

1. Buka aplikasi di browser: `https://your-app-name.vercel.app`
2. Login dengan:
   - **Email:** galihkur@gmail.com
   - **Password:** admin1234
3. Jika berhasil, kamu akan redirect ke `/dashboard`

---

## 🐛 Troubleshooting

### ❌ Problem: Login stuck di "redirecting"

**Penyebab:**
- `NEXTAUTH_URL` tidak di-set atau salah
- `NEXTAUTH_SECRET` tidak di-set
- Environment variables belum di-apply (perlu redeploy)

**Solusi:**
1. Cek Vercel Dashboard → Settings → Environment Variables
2. Pastikan `NEXTAUTH_URL` dan `NEXTAUTH_SECRET` sudah ada
3. Pastikan `NEXTAUTH_URL` sesuai dengan domain produksi (bukan localhost!)
4. Redeploy aplikasi dari tab Deployments

### ❌ Problem: "Configuration Error"

**Solusi:**
- Generate ulang `NEXTAUTH_SECRET` dengan `openssl rand -base64 32`
- Pastikan tidak ada spasi atau karakter aneh
- Update di Vercel Environment Variables
- Redeploy

### ❌ Problem: Google Login tidak berfungsi

**Solusi:**
1. Pastikan sudah setup Google OAuth Console
2. Tambahkan authorized redirect URI: `https://your-app-name.vercel.app/api/auth/callback/google`
3. Set `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di Vercel
4. Redeploy

---

## 🔄 Update Environment Variables

Jika perlu update environment variables setelah deploy:

1. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Edit atau tambah variable baru
3. Klik **Save**
4. **WAJIB:** Redeploy aplikasi agar perubahan apply
   - Tab **Deployments** → Pilih deployment terakhir → **"⋯"** → **Redeploy**

---

## 🎯 Custom Domain (Optional)

Untuk menggunakan domain sendiri (misal: ramadhan.example.com):

1. Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Tambahkan custom domain
3. **Update** `NEXTAUTH_URL` di Environment Variables dengan custom domain
4. Redeploy

---

## 📱 Progressive Web App (PWA)

Aplikasi ini sudah support PWA. Setelah deploy:

1. Buka aplikasi di mobile browser
2. Tap menu browser → **"Add to Home Screen"** / **"Install App"**
3. Aplikasi bisa digunakan seperti native app

---

## 🆘 Butuh Bantuan?

- Cek [NextAuth Documentation](https://next-auth.js.org/deployment)
- Cek [Vercel Documentation](https://vercel.com/docs)
- Lihat Vercel Deployment Logs untuk error details

---

## ✨ Selamat!

Aplikasi Ramadhan Tracker kamu sekarang sudah online! 🎉

URL: `https://your-app-name.vercel.app`
