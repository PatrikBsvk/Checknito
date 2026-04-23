# Transmise Control - PWA Application

Moderní PWA aplikace pro správu eskalačního feedu a archívu transmisí.

## ✨ Features

- **📊 Feed & Archiv** - Zobrazení transmisí s filtry a real-time aktualizacemi
- **➕ Přidávání transmisí** - Formulář s validací, upload fotek (max 5MB)
- **🏷️ Správa operátorů** - Admin funkce pro přidávání/mazání operátorů
- **📥 Excel Export** - Stažení viditelných řádků (respektuje filtr a search)
- **🔐 Autentifikace** - Email/heslo přes Supabase Auth
- **🔄 Realtime** - Postgres_changes pro live aktualizace
- **📱 PWA** - Installable na mobilu, offline fallback
- **🎨 Minimalistní design** - Pico CSS bez zbytečného stylingu
- **🔒 RLS políčky** - Secure DB access s admin rolí

## 🛠️ Tech Stack

- **Next.js 16.2+** (App Router, TypeScript)
- **Supabase** (PostgreSQL auth + storage)
- **Pico CSS** (minimalistní UI)
- **XLSX** (Excel export)
- **Service Worker** (offline support)

## 📁 Struktura Projektu

```
app/
├── layout.tsx              # Root layout + Pico CSS
├── page.tsx               # Redirect auth check
├── login/page.tsx         # Login/registration
└── (protected)/
    ├── layout.tsx         # Auth guard + navbar
    ├── feed/page.tsx      # Hlavní feed
    ├── archive/page.tsx   # Archivované transmise
    └── settings/page.tsx  # Admin: správa operátorů

src/
├── lib/
│   ├── supabase.ts        # Client initialization
│   └── supabase-service.ts # DB & storage functions
├── types/
│   └── index.ts           # TypeScript interfaces
└── components/
    ├── TransmissionForm.tsx
    ├── TransmissionTable.tsx
    ├── SearchBar.tsx
    ├── FilterToggle.tsx
    ├── ExportButton.tsx
    ├── OperatorManager.tsx
    └── Toast.tsx
```

## 🚀 Quick Start

### 1. Supabase Setup
Viz [SETUP.md](./SETUP.md) - spustit SQL script, vytvořit storage bucket, nastavit auth

### 2. Konfigurační soubory
```bash
# Vyplnit .env.local s Supabase kredencemi
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### 3. Install & Run
```bash
npm install
npm run dev
# Navštívit http://localhost:3000
```

### 4. Admin Setup
- Zaregistrovat se (Any email works)
- V Supabase: Update user metadata → `{"role":"admin"}`
- Login a přijít do Settings, přidat operátory

## 📖 Workflow

### Běžný uživatel (Operátor)
1. **Přihlášení** - Email/heslo
2. **Feed** - Vidí transmise (poslední 7 dní, není archivováno)
3. **Přidat transmisi** - Formulář se fotkami
4. **Akce** - Archivovat / Smazat / Zobrazit fotky
5. **Filtery** - Search + "Jen moje" toggle
6. **Export** - Stažení jako Excel

### Admin
- Vše co běžný uživatel
- **Settings** - Přidávat/mazat operátory
- Realtime aktualizace seznamu operátorů

## 🎯 Database Schema

### Operators
```sql
id UUID PRIMARY KEY
name TEXT NOT NULL UNIQUE
created_at TIMESTAMP
```

### Transmissions
```sql
id UUID PRIMARY KEY
transmission_number TEXT NOT NULL
operator_id UUID → operators
completed_at TIMESTAMP NOT NULL
has_errors BOOLEAN
errors JSONB (array)
photo_left TEXT (storage URL)
photo_right TEXT (storage URL)
created_by UUID → auth.users
created_at TIMESTAMP
archived BOOLEAN
```

## 🔐 Security

- **RLS Policies** - Uživatelé vidí jen svoje (admin vidí všechny)
- **File Upload** - Validace (jpg/png, max 5MB)
- **Auth** - Supabase manages sessions
- **Service Worker** - Cache assets, offline graceful fallback

## 🧪 Testing Checklist

- [ ] Login/signup flow
- [ ] Přidání transmise + upload fotek
- [ ] Feed zobrazuje poslední 7 dní
- [ ] Search funguje (číslo + operátor)
- [ ] Filter "Jen moje" funguje
- [ ] Archivování + obnovení z archívu
- [ ] Smazání (fotky se smažou ze Storage)
- [ ] Admin: Přidání/smazání operátora
- [ ] Realtime: Nová transmise se objeví live
- [ ] Excel export
- [ ] PWA installable na mobilu

## 📦 Production Build

```bash
npm run build
npm run start
```

Nebo deploy na Vercel:
```bash
vercel
```

## 📝 Poznámky

- Pico CSS je linkován z CDN (bez npm dependence)
- Service Worker pro offline fallback
- Toast notifikace inline (bez sonner)
- TypeScript strict mode
- Všechny required fieldy validovány
- Fotky max 5MB, jpg/png
- Při smazání transmise se smažou i fotky
- Archivování jen změní `archived = TRUE`

## 🆘 Troubleshooting

**Chyba: "No session"**
- Zkontrolovat `.env.local` - Supabase URL a key
- Zkontrolovat cookies v prohlížeči

**Fotky se nenahrajou**
- Zkontrolovat Storage bucket permissions
- Velikost souboru (max 5MB)

**Realtime neaktualizuje**
- Zkontrolovat Supabase project aktivita
- Refreshnout stránku

**Admin role nefunguje**
- V Supabase: UPDATE user metadata
- Logout a login znovu

## 📄 License

MIT
