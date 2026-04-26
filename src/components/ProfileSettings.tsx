'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/src/lib/supabase';
import { deriveDisplayName } from '@/src/lib/user';
import Toast from './Toast';

interface ProfileSettingsProps {
  /** Pokud rodič potřebuje vědět o změně jména (např. aby aktualizoval sidebar). */
  onNameChanged?: (newName: string) => void;
}

/**
 * Blok "Můj profil" v Nastavení — uživatel si tady může nastavit
 * zobrazované jméno (uloží se do Supabase user_metadata.display_name).
 *
 * Je přístupný VŠEM přihlášeným uživatelům, ne jen adminům.
 */
export default function ProfileSettings({ onNameChanged }: ProfileSettingsProps = {}) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [derivedPlaceholder, setDerivedPlaceholder] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? '');

      const meta = user.user_metadata ?? {};
      const currentName =
        typeof meta.display_name === 'string' ? meta.display_name : '';
      setName(currentName);
      setInitialName(currentName);

      // Pokud jméno nastavené není, ukážeme v placeholderu odvozené jméno
      setDerivedPlaceholder(
        deriveDisplayName({ email: user.email, user_metadata: { } as Record<string, unknown> })
      );

      setLoading(false);
    };
    load();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmed = name.trim();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: trimmed || null },
      });
      if (error) throw error;
      setInitialName(trimmed);
      onNameChanged?.(trimmed);
      setToast({
        type: 'success',
        message: trimmed ? 'Jméno uloženo.' : 'Jméno odstraněno.',
      });
    } catch (err) {
      console.error('Error updating display name:', err);
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Nepodařilo se uložit jméno.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Načítám profil…</p>;
  }

  const isDirty = name.trim() !== initialName.trim();

  return (
    <div className="form-section" style={{ marginBottom: '2rem' }}>
      <h2>Můj profil</h2>

      <div className="form-group">
        <label>Email</label>
        <input type="email" value={email} disabled />
        <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
          Přihlašovací email (nelze změnit odsud).
        </small>
      </div>

      <div className="form-group">
        <label>Zobrazované jméno</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={derivedPlaceholder || 'Jméno'}
          disabled={saving}
          maxLength={40}
        />
        <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
          Používá se v sidebaru a v budoucích statistikách. Pokud necháš prázdné,
          automaticky se použije jméno odvozené z emailu (<strong>{derivedPlaceholder}</strong>).
        </small>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={handleSave}
        disabled={saving || !isDirty}
      >
        {saving ? 'Ukládám…' : 'Uložit jméno'}
      </button>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
