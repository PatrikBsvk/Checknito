import { NextResponse } from 'next/server';
import { createAdminClient } from '@/src/lib/supabase-admin';

/**
 * Automatický cleanup starých fotek (Varianta A).
 *
 * Pravidla:
 *   - mažou se **jen soubory ve Storage**, záznam v DB zůstává
 *   - `photo_left` / `photo_right` se v DB nulují (UI pak zobrazí prázdno)
 *   - **archivované transmise se nevyčišťují** — ty chceme mít kompletní
 *   - cutoff = 30 dní od `created_at`
 *
 * Spouštění:
 *   - Vercel Cron → viz `vercel.json` (denně v 03:00 UTC)
 *   - manuálně: `curl -H "Authorization: Bearer $CRON_SECRET" \
 *                  https://…/api/cleanup-old-photos`
 *
 * Bezpečnost:
 *   - Vercel Cron posílá header `Authorization: Bearer <CRON_SECRET>`
 *   - cokoli bez správného tokenu → 401
 *   - používá service role klienta (obchází RLS, server-only)
 */

const DAYS = 30;
const BUCKET = 'transmission-photos';

// Vercel Cron by měl být jediný volající v produkci, ale endpoint musí být
// vždy dostupný (GET). Autorizujeme přes CRON_SECRET.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

/**
 * Z public URL Supabase Storage vytáhne jen název souboru (tj. path v bucketu).
 * Příklad:
 *   https://xxx.supabase.co/storage/v1/object/public/transmission-photos/abc.jpg
 *   → "abc.jpg"
 */
function extractFileName(url: string | null): string | null {
  if (!url) return null;
  try {
    const marker = `/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) {
      // fallback: vezmi poslední segment za /
      return url.split('/').pop() || null;
    }
    return url.slice(idx + marker.length) || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);
  const cutoffIso = cutoff.toISOString();

  // Najdi kandidáty: starší než cutoff, ne-archivované, s alespoň jednou fotkou.
  const { data: rows, error: selectError } = await supabase
    .from('transmissions')
    .select('id, photo_left, photo_right')
    .lt('created_at', cutoffIso)
    .eq('archived', false)
    .or('photo_left.not.is.null,photo_right.not.is.null');

  if (selectError) {
    console.error('[cleanup] select selhal:', selectError);
    return NextResponse.json(
      { error: 'DB select failed', details: selectError.message },
      { status: 500 },
    );
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      cleaned: 0,
      filesDeleted: 0,
      cutoff: cutoffIso,
      message: 'Nic ke smazání.',
    });
  }

  // Sesbírej soubory ve Storage ke smazání.
  const files = rows
    .flatMap((r) => [r.photo_left, r.photo_right])
    .map(extractFileName)
    .filter((x): x is string => Boolean(x));

  let filesDeleted = 0;
  if (files.length > 0) {
    const { data: removed, error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove(files);

    if (removeError) {
      // Nechceme selhat celý cleanup, když nějaký soubor už neexistuje.
      // Zalogujeme a pokračujeme s DB updatem — dir. DB konzistence je důležitější.
      console.error('[cleanup] storage.remove varování:', removeError);
    } else {
      filesDeleted = removed?.length ?? 0;
    }
  }

  // Vynuluj foto sloupce v DB (jediná operace, hromadně).
  const ids = rows.map((r) => r.id);
  const { error: updateError } = await supabase
    .from('transmissions')
    .update({ photo_left: null, photo_right: null })
    .in('id', ids);

  if (updateError) {
    console.error('[cleanup] update selhal:', updateError);
    return NextResponse.json(
      { error: 'DB update failed', details: updateError.message },
      { status: 500 },
    );
  }

  console.log(
    `[cleanup] hotovo: ${ids.length} záznamů, ${filesDeleted}/${files.length} souborů`,
  );

  return NextResponse.json({
    cleaned: ids.length,
    filesDeleted,
    filesAttempted: files.length,
    cutoff: cutoffIso,
  });
}
