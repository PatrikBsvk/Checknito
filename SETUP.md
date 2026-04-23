# Transmise Control - Setup Guide

## 1. Supabase Setup

### Create Database Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create operators table
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transmissions table
CREATE TABLE public.transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transmission_number TEXT NOT NULL,
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  has_errors BOOLEAN DEFAULT FALSE,
  errors JSONB DEFAULT '[]'::jsonb,
  photo_left TEXT,
  photo_right TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE public.transmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transmissions
-- Users see their own transmissions or all if admin
CREATE POLICY "Users see own transmissions" ON public.transmissions
  FOR SELECT USING (
    created_by = auth.uid()
    OR auth.jwt()->>'role' = 'admin'
  );

CREATE POLICY "Users create their own" ON public.transmissions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own transmissions" ON public.transmissions
  FOR UPDATE USING (
    created_by = auth.uid()
    OR auth.jwt()->>'role' = 'admin'
  );

CREATE POLICY "Users delete own transmissions" ON public.transmissions
  FOR DELETE USING (
    created_by = auth.uid()
    OR auth.jwt()->>'role' = 'admin'
  );

-- RLS Policies for operators (all authenticated users can see)
CREATE POLICY "All authenticated users see operators" ON public.operators
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins add operators" ON public.operators
  FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Only admins delete operators" ON public.operators
  FOR DELETE USING (auth.jwt()->>'role' = 'admin');

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('transmission-photos', 'transmission-photos', true);

-- RLS Policies for storage
CREATE POLICY "Public read access to photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'transmission-photos');

CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'transmission-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'transmission-photos');
```

### Auth Configuration

1. Go to Authentication > Providers
2. Enable Email/Password provider
3. Configure email templates if needed

### Set Admin User

1. In Supabase, go to SQL Editor and run:
```sql
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'::jsonb
WHERE email = 'your-admin-email@example.com';
```

## 2. Environment Setup

1. Copy `.env.local` and fill in your Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL` - from Supabase project settings
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - from Supabase API keys

```bash
cp .env.local.example .env.local
```

## 3. Install Dependencies

```bash
npm install
```

## 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## 5. Test Workflow

1. **Create Account**: Go to login page, click "Registrovat se"
2. **Add Operators**: Login with admin account, go to Settings and add operators
3. **Add Transmission**: In Feed, fill the form and submit
4. **View in Feed**: New transmission appears in real-time
5. **Archive**: Click "Archivovat" to move to archive
6. **Export**: Click "Stáhnout jako Excel" to export visible rows

## 6. Build for Production

```bash
npm run build
npm run start
```

## 7. Deploy to Vercel (Optional)

```bash
npm install -g vercel
vercel
```

Follow the prompts and set environment variables in Vercel dashboard.

## Notes

- All photos are stored in Supabase Storage (public bucket)
- Realtime updates work via Supabase postgres_changes
- Service Worker enables offline fallback for assets
- Admin role is managed via Supabase auth metadata
