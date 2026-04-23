#!/usr/bin/env node
/**
 * Setup admin user
 *
 * Finds a user by email, auto-confirms their email, and sets admin role.
 * Usage:
 *   node scripts/setup-admin.js <email>
 *
 * Example:
 *   node scripts/setup-admin.js patrik.bonko@gmail.com
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/setup-admin.js <email>');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log(`🔎 Looking for user: ${email}`);

  // List users (paginated, but one page is fine for small setups)
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  const user = list.users.find((u) => u.email === email);

  if (!user) {
    console.log(`   ✗ User not found. Creating a new one...`);
    console.log(`     (Note: you'll need to set the password via the app or dashboard)`);
    console.log('');
    console.log(`👉 Register the user first in the app at http://localhost:3000/login`);
    console.log(`   then re-run this script.`);
    process.exit(1);
  }

  console.log(`   ✓ Found user (id: ${user.id})`);
  console.log(`   Email confirmed: ${user.email_confirmed_at ? '✓' : '✗'}`);
  console.log(`   Current metadata: ${JSON.stringify(user.user_metadata || {})}`);
  console.log('');

  // Auto-confirm email + set admin role
  console.log('🔧 Confirming email + setting admin role...');
  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: { ...(user.user_metadata || {}), role: 'admin' },
  });
  if (updateErr) throw updateErr;

  console.log('');
  console.log('✅ Done! You can now:');
  console.log(`   • Log in at http://localhost:3000/login with ${email}`);
  console.log(`   • Access /settings to manage operators (admin-only)`);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
