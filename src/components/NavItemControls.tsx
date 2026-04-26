'use client';

import { useEffect, useRef, useState } from 'react';
import { IconKey, NAV_ICONS } from '@/src/lib/nav-icons';

interface NavItemControlsProps {
  currentLabel: string;            // aktuálně zobrazený label (po override)
  currentIcon: IconKey;            // aktuálně zobrazená ikona
  defaultLabel: string;            // výchozí label (pro placeholder při resetu)
  defaultIcon: IconKey;            // výchozí ikona
  onRename: (label: string | undefined) => void;
  onChangeIcon: (icon: IconKey | undefined) => void;
  onReset: () => void;
}

// Ikona kebab (tři svislé tečky).
const IconKebab = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="5" r="1.25" />
    <circle cx="12" cy="12" r="1.25" />
    <circle cx="12" cy="19" r="1.25" />
  </svg>
);

type ModalKind = null | 'rename' | 'icon';

export default function NavItemControls({
  currentLabel,
  currentIcon,
  defaultLabel,
  defaultIcon,
  onRename,
  onChangeIcon,
  onReset,
}: NavItemControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [renameValue, setRenameValue] = useState(currentLabel);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Click outside → zavřít menu
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // Escape kdekoliv
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setModal(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openRename = () => {
    setRenameValue(currentLabel);
    setModal('rename');
    setMenuOpen(false);
  };

  const openIcon = () => {
    setModal('icon');
    setMenuOpen(false);
  };

  const handleResetClick = () => {
    onReset();
    setMenuOpen(false);
  };

  const submitRename = () => {
    const val = renameValue.trim();
    // Pokud stejné jako default → resetneme pole
    if (!val || val === defaultLabel) {
      onRename(undefined);
    } else {
      onRename(val);
    }
    setModal(null);
  };

  const pickIcon = (key: IconKey) => {
    // Pokud stejné jako default → reset
    if (key === defaultIcon) {
      onChangeIcon(undefined);
    } else {
      onChangeIcon(key);
    }
    setModal(null);
  };

  return (
    <>
      <div className="nav-item-controls" ref={menuRef}>
        <button
          type="button"
          className="nav-kebab"
          aria-label={`Upravit ${currentLabel}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <IconKebab />
        </button>

        {menuOpen && (
          <div className="nav-kebab-menu" role="menu">
            <button type="button" role="menuitem" onClick={openRename}>
              Přejmenovat
            </button>
            <button type="button" role="menuitem" onClick={openIcon}>
              Změnit ikonu
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleResetClick}
              className="nav-kebab-reset"
            >
              Obnovit výchozí
            </button>
          </div>
        )}
      </div>

      {/* ---- Přejmenovat modal ---- */}
      {modal === 'rename' && (
        <div
          className="nav-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="nav-modal" role="dialog" aria-label="Přejmenovat položku">
            <h3>Přejmenovat položku</h3>
            <p className="nav-modal-hint">Výchozí: {defaultLabel}</p>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setModal(null);
              }}
              placeholder={defaultLabel}
            />
            <div className="nav-modal-actions">
              <button type="button" onClick={() => setModal(null)}>
                Zrušit
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitRename}
              >
                Uložit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Změnit ikonu modal ---- */}
      {modal === 'icon' && (
        <div
          className="nav-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="nav-modal nav-modal-wide" role="dialog" aria-label="Vybrat ikonu">
            <h3>Vybrat ikonu pro „{currentLabel}“</h3>
            <div className="icon-picker-grid">
              {(Object.keys(NAV_ICONS) as IconKey[]).map((key) => {
                const { label, render } = NAV_ICONS[key];
                const isActive = key === currentIcon;
                const isDefault = key === defaultIcon;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`icon-picker-cell ${isActive ? 'active' : ''}`}
                    onClick={() => pickIcon(key)}
                    title={label + (isDefault ? ' (výchozí)' : '')}
                  >
                    {render()}
                    <span className="icon-picker-label">
                      {label}
                      {isDefault ? ' ·' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="nav-modal-actions">
              <button type="button" onClick={() => setModal(null)}>
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

