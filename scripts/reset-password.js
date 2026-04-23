#!/usr/bin/env node
/**
 * Reset a user's password (admin override, no email needed).
 * Usage: node scripts/reset-password.js <email> <new-password>
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

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/reset-password.js <email> <new-password>');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const { data: list } = await supabase.auth.admin.listUsers();
  const user = list.users.find((u) => u.email === email);
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
  console.log(`✅ Password updated for ${email}`);
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
