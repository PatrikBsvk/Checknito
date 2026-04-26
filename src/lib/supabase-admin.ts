import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase klient se **service role** klíčem.
 * Obchází RLS — POUŽÍVAT VÝHRADNĚ v API routes / cronech, NIKDY v klientském kódu.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL      — URL projektu (stejná jako pro anon klienta)
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key z Supabase → Settings → API
 *
 * Pokud by se tento soubor importoval v klientské komponentě, Next.js (díky
 * absenci `NEXT_PUBLIC_` prefixu u service role key) selže na build / runtime,
 * což je **záměr** — klíč se nesmí leaknout do browseru.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Chybí env proměnné NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
