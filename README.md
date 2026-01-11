This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Buat file `.env.local` di root project dengan isi:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id (optional)
GOOGLE_CLIENT_SECRET=your-google-client-secret (optional)
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

Atau gunakan tool online: https://generate-secret.vercel.app/32

## Credential Login (Default)

Email: galihkur@gmail.com
Password: admin1234

## Deploy ke Vercel

### Langkah-langkah:

1. Push code ke GitHub repository
2. Buka [Vercel Dashboard](https://vercel.com/dashboard)
3. Import repository
4. **PENTING:** Tambahkan Environment Variables di Vercel:
   - `NEXTAUTH_URL` = `https://your-app-name.vercel.app` (ganti dengan domain Vercel kamu)
   - `NEXTAUTH_SECRET` = hasil generate dari `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` = (optional, jika pakai Google login)
   - `GOOGLE_CLIENT_SECRET` = (optional, jika pakai Google login)
   
5. Deploy!

### Troubleshooting Login "Stuck at Redirecting"

Jika login stuck di "redirecting", pastikan:
- ✅ `NEXTAUTH_URL` sudah di-set di Vercel Environment Variables
- ✅ `NEXTAUTH_SECRET` sudah di-set di Vercel Environment Variables  
- ✅ `NEXTAUTH_URL` menggunakan domain produksi yang benar (bukan localhost)
- ✅ Setelah menambah/mengubah environment variables, redeploy aplikasi

### Update Domain di Vercel

Jika menggunakan custom domain:
1. Buka Vercel Dashboard → Project Settings → Environment Variables
2. Update `NEXTAUTH_URL` menjadi custom domain kamu
3. Redeploy project

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

