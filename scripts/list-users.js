#!/usr/bin/env node
/**
 * List všech registrovaných uživatelů (email, role, created_at).
 * Usage: node scripts/list-users.js
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const { data: list, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;

  if (list.users.length === 0) {
    console.log('Žádní registrovaní uživatelé.');
    return;
  }

  console.log(`\nNalezeno ${list.users.length} uživatel${list.users.length === 1 ? '' : 'ů'}:\n`);
  for (const u of list.users) {
    const role = u.user_metadata?.role || u.app_metadata?.role || '-';
    const created = new Date(u.created_at).toLocaleString('cs-CZ');
    const lastSignIn = u.last_sign_in_at
      ? new Date(u.last_sign_in_at).toLocaleString('cs-CZ')
      : 'nikdy';
    console.log(`  📧 ${u.email}`);
    console.log(`     id:           ${u.id}`);
    console.log(`     role:         ${role}`);
    console.log(`     vytvořeno:    ${created}`);
    console.log(`     poslední login: ${lastSignIn}`);
    console.log('');
  }
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
