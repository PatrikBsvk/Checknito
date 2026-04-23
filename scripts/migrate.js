#!/usr/bin/env node
/**
 * Supabase Migration Script
 *
 * Sets up the database schema, RLS policies, and storage bucket for the
 * Transmise Control app. Uses the service_role key to bypass RLS and run
 * admin operations directly.
 *
 * Usage:
 *   node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');

// Load .env.local manually (no dotenv dep)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found at', envPath);
    process.exit(1);
  }
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

if (SUPABASE_URL.includes('/dashboard/')) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is wrong — it should be https://<project-ref>.supabase.co, not the dashboard URL');
  console.error('   Current value:', SUPABASE_URL);
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// SQL (run via the service role — note Supabase JS doesn't expose raw SQL, so
// we use the REST admin endpoint via fetch to the PostgREST / pg_meta route.
// Simpler: call rpc('exec_sql', ...) if a helper function exists. Since it
// doesn't, we POST DDL to /pg/query via the admin API.)
// ---------------------------------------------------------------------------

const SQL_STATEMENTS = [
  // 1. Operators table
  `CREATE TABLE IF NOT EXISTS operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // 2. Transmissions table
  `CREATE TABLE IF NOT EXISTS transmissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transmission_number TEXT NOT NULL,
    operator_id UUID REFERENCES operators(id),
    completed_at TIMESTAMP NOT NULL,
    has_errors BOOLEAN DEFAULT FALSE,
    errors JSONB DEFAULT '[]'::jsonb,
    photo_left TEXT,
    photo_right TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    archived BOOLEAN DEFAULT FALSE
  );`,

  // 3. Enable RLS
  `ALTER TABLE operators ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE transmissions ENABLE ROW LEVEL SECURITY;`,

  // 4. Drop existing policies (idempotent)
  `DROP POLICY IF EXISTS "operators_select" ON operators;`,
  `DROP POLICY IF EXISTS "operators_insert_admin" ON operators;`,
  `DROP POLICY IF EXISTS "operators_delete_admin" ON operators;`,
  `DROP POLICY IF EXISTS "transmissions_select" ON transmissions;`,
  `DROP POLICY IF EXISTS "transmissions_insert" ON transmissions;`,
  `DROP POLICY IF EXISTS "transmissions_update" ON transmissions;`,
  `DROP POLICY IF EXISTS "transmissions_delete" ON transmissions;`,

  // 5. Operators policies
  `CREATE POLICY "operators_select" ON operators
    FOR SELECT TO authenticated USING (true);`,

  `CREATE POLICY "operators_insert_admin" ON operators
    FOR INSERT TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
      )
    );`,

  `CREATE POLICY "operators_delete_admin" ON operators
    FOR DELETE TO authenticated USING (
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
      )
    );`,

  // 6. Transmissions policies
  `CREATE POLICY "transmissions_select" ON transmissions
    FOR SELECT TO authenticated USING (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
      )
    );`,

  `CREATE POLICY "transmissions_insert" ON transmissions
    FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());`,

  `CREATE POLICY "transmissions_update" ON transmissions
    FOR UPDATE TO authenticated USING (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
      )
    );`,

  `CREATE POLICY "transmissions_delete" ON transmissions
    FOR DELETE TO authenticated USING (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
      )
    );`,

  // 7. Helpful indexes
  `CREATE INDEX IF NOT EXISTS idx_transmissions_created_by ON transmissions(created_by);`,
  `CREATE INDEX IF NOT EXISTS idx_transmissions_archived ON transmissions(archived);`,
  `CREATE INDEX IF NOT EXISTS idx_transmissions_created_at ON transmissions(created_at DESC);`,
];

// Supabase doesn't expose a raw SQL endpoint via the JS client by default.
// We use the management API via fetch instead.
async function execSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL failed (${res.status}): ${text}\nQuery: ${sql.slice(0, 200)}`);
  }
}

// Since exec_sql RPC likely doesn't exist, fall back to using PostgREST-compatible
// schema operations via direct HTTP. Actually the cleanest path is to first install
// a small helper function via the management API. But that requires a PAT, not
// service_role.
//
// Alternative: use pg REST via `/pg/query` if exposed. Supabase has a `pg_meta`
// API at `${SUPABASE_URL}/pg-meta/default/query` but it's admin-gated.
//
// Cleanest: install a SECURITY DEFINER `exec_sql` function using the REST API's
// sql extension — BUT that also requires raw SQL execution. Chicken and egg.
//
// Pragmatic workaround: check whether the tables exist via REST; if not, tell
// the user to paste the SQL into the Supabase dashboard SQL editor.

async function checkTablesExist() {
  // Try SELECT on each expected table
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/operators?select=id&limit=1`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    const txt = await res.text();
    if (res.status === 200) return { operators: true, transmissions: await tableExists('transmissions') };
    return { operators: false, transmissions: await tableExists('transmissions') };
  } catch {
    return { operators: false, transmissions: false };
  }
}

async function tableExists(table) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function createBucket() {
  console.log('📦 Creating storage bucket "transmission-photos"...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = buckets.find((b) => b.name === 'transmission-photos');
  if (exists) {
    console.log('   ✓ Bucket already exists');
    return;
  }

  const { error } = await supabase.storage.createBucket('transmission-photos', {
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  });
  if (error) throw error;
  console.log('   ✓ Bucket created');
}

async function main() {
  console.log('🚀 Supabase migration starting...');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log('');

  // Step 1: check if tables already exist
  console.log('🔍 Checking existing schema...');
  const { operators, transmissions } = await checkTablesExist();

  if (operators && transmissions) {
    console.log('   ✓ Tables already exist — skipping schema creation');
  } else {
    console.log(`   operators: ${operators ? '✓' : '✗'}, transmissions: ${transmissions ? '✓' : '✗'}`);
    console.log('');
    console.log('⚠️  Tables missing. The Supabase JS client cannot run raw DDL.');
    console.log('');
    console.log('📋 Please copy the SQL below into:');
    console.log(`   ${SUPABASE_URL.replace('.supabase.co', '').replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`);
    console.log('');
    console.log('─────────── COPY BELOW ───────────');
    console.log('');
    console.log(SQL_STATEMENTS.join('\n\n'));
    console.log('');
    console.log('─────────── END ───────────');
    console.log('');
    console.log('After running the SQL, re-run this script to create the storage bucket.');
    process.exit(1);
  }

  // Step 2: create storage bucket
  await createBucket();

  console.log('');
  console.log('✅ Migration complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Create a user account at http://localhost:3000/login');
  console.log('  2. In Supabase dashboard → Authentication → Users → select your user → edit user metadata:');
  console.log('     {"role": "admin"}');
  console.log('  3. Run: npm run dev');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
