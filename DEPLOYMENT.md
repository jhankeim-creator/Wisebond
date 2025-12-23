# KAYICOM - Gid Deplwaman Vercel

## 📋 Kondisyon Preliminè

1. **Kont Vercel** - Kreye yon kont sou [vercel.com](https://vercel.com)
2. **MongoDB Atlas** - Kreye yon baz done sou [mongodb.com](https://www.mongodb.com/cloud/atlas)
3. **Resend (Opsyonèl)** - Pou voye imèl, kreye kont sou [resend.com](https://resend.com)

---

## 🚀 Deplwaman Otomatik

### Etap 1: Konekte Repozitwa a

1. Ale sou [vercel.com/new](https://vercel.com/new)
2. Enpòte repozitwa GitHub ou a
3. Vercel ap detekte konfigirasyon an otomatikman

### Etap 2: Konfigure Varyab Anviwònman

Nan Vercel Dashboard, ale nan **Settings → Environment Variables** epi ajoute:

| Non Varyab | Deskripsyon | Egzanp |
|------------|-------------|--------|
| `MONGO_URL` | URL koneksyon MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `DB_NAME` | Non baz done | `kayicom` |
| `JWT_SECRET` | Kle sekrè pou token JWT | `yon-kle-sekre-long-e-konplike` |
| `FRONTEND_URL` | URL sit entènèt la | `https://kayicom.vercel.app` |
| `CORS_ORIGINS` | Orijin CORS (virgule pou separe) | `https://kayicom.vercel.app` |
| `RESEND_API_KEY` | (Opsyonèl) Kle API Resend | `re_xxxxxxxxxxxx` |
| `SENDER_EMAIL` | (Opsyonèl) Imèl pou voye | `noreply@kayicom.com` |

### Etap 3: Deplwaye

Klike sou **Deploy** - Vercel ap:
1. Bati frontend React la
2. Deplwaye API Python nan kòm fonksyon serverless
3. Konfigure routing otomatikman

---

## 🔧 Konfigirasyon MongoDB Atlas

1. Kreye yon klòstè gratis sou MongoDB Atlas
2. Nan **Network Access**, ajoute `0.0.0.0/0` pou pèmèt tout IP (pou Vercel serverless)
3. Kreye yon itilizatè baz done
4. Jwenn URL koneksyon an nan **Connect → Connect your application**

---

## 🔐 Kont Admin Defòlt

Apre premye deplwaman an, yon kont admin kreye otomatikman:

- **Email:** `admin@kayicom.com`
- **Modpas:** `Admin123!`

⚠️ **ENPÒTAN:** Chanje modpas sa a imedyatman apre ou konekte!

---

## 📁 Estrikti Pwojè

```
/
├── api/
│   ├── index.py          # API FastAPI (serverless)
│   └── requirements.txt  # Depandans Python
├── frontend/
│   ├── src/              # Kòd React
│   ├── public/           # Fichye estatik
│   └── package.json      # Depandans Node.js
├── vercel.json           # Konfigirasyon Vercel
└── .env.example          # Egzanp varyab anviwònman
```

---

## 🌐 URL API

Apre deplwaman:
- **Frontend:** `https://your-app.vercel.app`
- **API Docs:** `https://your-app.vercel.app/api/docs`
- **API Health:** `https://your-app.vercel.app/api/health`

---

## 🔄 Redeplwaman

Chak fwa ou pouse chanjman nan branch `main`:
- Vercel ap redeplwaye otomatikman
- Ou kapab wè pwogrè nan Vercel Dashboard

---

## 🐛 Rezoud Pwoblèm

### Erè "Function Timeout"
- Ogmante `maxDuration` nan `vercel.json`
- Verifye koneksyon MongoDB

### Erè CORS
- Verifye `CORS_ORIGINS` gen bon URL la
- Asire ou gen virgil ant plizyè orijin

### Baz Done Pa Konekte
- Verifye `MONGO_URL` kòrèk
- Verifye IP whitelist nan MongoDB Atlas

---

## 📞 Sipò

Pou kesyon oswa pwoblèm, kontakte ekip devlopman an.
