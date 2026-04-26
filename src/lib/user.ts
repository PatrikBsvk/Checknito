// Pomocníky pro zobrazení uživatele v UI (avatar, jméno).

interface LikeUser {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Vrátí zobrazované jméno uživatele:
 *  1. pokud si uživatel nastavil `user_metadata.display_name` → použije ho
 *  2. jinak odvodí z emailu (první část před tečkou / pomlčkou / podtržítkem)
 *     "patrik.bonko@gmail.com" → "Patrik"
 *  3. fallback: email nebo "Uživatel"
 */
export function deriveDisplayName(user: LikeUser | null | undefined): string {
  if (!user) return 'Uživatel';

  const meta = user.user_metadata ?? {};
  const metaName =
    typeof meta.display_name === 'string' ? meta.display_name.trim() : '';
  if (metaName) return metaName;

  const email = user.email ?? '';
  const local = email.split('@')[0] ?? '';
  const firstChunk = local.split(/[._-]/)[0] ?? '';
  if (firstChunk) {
    return firstChunk.charAt(0).toUpperCase() + firstChunk.slice(1).toLowerCase();
  }
  return email || 'Uživatel';
}

/** První písmeno pro avatar. */
export function initialFromName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() || '?';
}
