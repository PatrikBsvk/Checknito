'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './ThemeProvider';
import { initialFromName } from '@/src/lib/user';
import { createClient } from '@/src/lib/supabase';
import { getOperators } from '@/src/lib/supabase-service';
import { Operator } from '@/src/types';
import OperatorManager from './OperatorManager';
import ProfileSettings from './ProfileSettings';
import Toast from './Toast';

interface UserMenuProps {
  displayName: string;
  email: string;
  isAdmin?: boolean;
  onLogout: () => void;
  /** Zavolá se po úspěšném uložení nového jména. Parent si aktualizuje svůj state. */
  onNameChanged?: (newName: string) => void;
}

// --- Ikony ----------------------------------------------------------------

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconCloseX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`user-menu-chevron ${open ? 'open' : ''}`}
    aria-hidden="true"
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const IconPencil = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// --------------------------------------------------------------------------

export default function UserMenu({
  displayName,
  email,
  isAdmin = false,
  onLogout,
  onNameChanged,
}: UserMenuProps) {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorsLoaded, setOperatorsLoaded] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const refreshOperators = useCallback(async () => {
    if (!isAdmin) return;
    const ops = await getOperators();
    setOperators(ops);
    setOperatorsLoaded(true);
  }, [isAdmin]);

  // Načti operátory při prvním otevření Nastavení (jen pokud admin)
  useEffect(() => {
    if (settingsOpen && isAdmin && !operatorsLoaded) {
      refreshOperators();
    }
  }, [settingsOpen, isAdmin, operatorsLoaded, refreshOperators]);

  // Esc zavře settings modal
  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  // Body scroll lock když je settings modal otevřený
  useEffect(() => {
    if (!settingsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [settingsOpen]);

  // Když se změní displayName zvenku (po refreshi session), sesyncuj edit value
  useEffect(() => {
    if (!editing) setEditValue(displayName);
  }, [displayName, editing]);

  // Click-outside zavře menu (NE když se edituje — jinak bys přišel o rozepsaný vstup)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (editing) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, editing]);

  // Escape — v edit módu zavře edit, jinak zavře celé menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(false);
          setEditValue(displayName);
        } else {
          setOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, displayName]);

  // Auto-focus input když začneš editovat
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditValue(displayName);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue(displayName);
  };

  const saveName = async () => {
    const trimmed = editValue.trim();
    // Pokud se nic nezměnilo → jen zavřeme edit bez network callu
    if (trimmed === displayName.trim()) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: trimmed || null },
      });
      if (error) throw error;
      onNameChanged?.(trimmed || '');
      setEditing(false);
      setToast({ type: 'success', message: 'Jméno uloženo.' });
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

  const avatarInitial = initialFromName(displayName);

  return (
    <div className="user-menu" ref={ref}>
      {open && (
        <div className="user-menu-popup" role="menu">
          {/* Hlavička: jméno + tužka (nebo input při editaci) + email pod tím */}
          <div className="user-menu-header">
            {editing ? (
              <div className="user-menu-name-edit">
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveName();
                    }
                  }}
                  placeholder="Tvé jméno"
                  maxLength={40}
                  disabled={saving}
                />
                <button
                  type="button"
                  className="user-menu-edit-btn save"
                  onClick={saveName}
                  disabled={saving}
                  aria-label="Uložit"
                  title="Uložit (Enter)"
                >
                  <IconCheck />
                </button>
                <button
                  type="button"
                  className="user-menu-edit-btn cancel"
                  onClick={cancelEdit}
                  disabled={saving}
                  aria-label="Zrušit"
                  title="Zrušit (Esc)"
                >
                  <IconX />
                </button>
              </div>
            ) : (
              <div className="user-menu-name-row">
                <div className="user-menu-header-name">{displayName}</div>
                <button
                  type="button"
                  className="user-menu-edit-btn pencil"
                  onClick={startEdit}
                  aria-label="Upravit jméno"
                  title="Upravit jméno"
                >
                  <IconPencil />
                </button>
              </div>
            )}
            <div className="user-menu-header-email" title={email}>
              {email}
            </div>
          </div>

          <div className="user-menu-divider" />

          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              toggle();
            }}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
            <span>{theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
          >
            <IconSettings />
            <span>Nastavení</span>
          </button>

          <div className="user-menu-divider" />

          <button
            type="button"
            role="menuitem"
            className="user-menu-item user-menu-item-danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <IconLogout />
            <span>Odhlásit se</span>
          </button>
        </div>
      )}

      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="user-menu-avatar">{avatarInitial}</div>
        <div className="user-menu-info">
          <div className="user-menu-name">{displayName}</div>
        </div>
        <IconChevron open={open} />
      </button>

      {toast && <Toast type={toast.type} message={toast.message} />}

      {settingsOpen && (
        <div
          className="settings-modal-backdrop"
          onClick={() => setSettingsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Nastavení"
        >
          <div
            className="settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h2>Nastavení</h2>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="Zavřít"
                title="Zavřít (Esc)"
              >
                <IconCloseX />
              </button>
            </div>

            <div className="settings-modal-body">
              <ProfileSettings onNameChanged={onNameChanged} />

              {isAdmin && (
                <OperatorManager
                  operators={operators}
                  onOperatorsChange={refreshOperators}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
