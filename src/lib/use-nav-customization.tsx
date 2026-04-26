'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconKey, NAV_ICONS } from './nav-icons';

// Klíč v localStorage. Verze v suffixu pro případné budoucí migrace.
const STORAGE_KEY = 'checknito:nav-customization:v1';

export interface NavCustomization {
  label?: string;
  icon?: IconKey;
}

export type NavCustomizationMap = Record<string, NavCustomization>;

// Validní klíče ikon pro sanity check při čtení z localStorage.
const validIconKeys = new Set(Object.keys(NAV_ICONS));

function readFromStorage(): NavCustomizationMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NavCustomizationMap;
    // Filtrujeme nevalidní ikony (např. po smazání z nav-icons.tsx)
    const cleaned: NavCustomizationMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      cleaned[key] = {
        label: typeof value.label === 'string' ? value.label : undefined,
        icon: value.icon && validIconKeys.has(value.icon) ? (value.icon as IconKey) : undefined,
      };
    }
    return cleaned;
  } catch (err) {
    console.warn('[nav-customization] failed to read storage', err);
    return {};
  }
}

function writeToStorage(map: NavCustomizationMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[nav-customization] failed to write storage', err);
  }
}

/**
 * Hook na uživatelskou personalizaci sidebaru (název + ikona)
 * uložená lokálně v prohlížeči.
 *
 *  key   - stabilní identifikátor položky (např. href "/feed")
 *  Vrací overrides + settery.
 */
export function useNavCustomization() {
  const [map, setMap] = useState<NavCustomizationMap>({});
  const [hydrated, setHydrated] = useState(false);

  // Inicializace z localStorage až po hydrataci (SSR-safe).
  useEffect(() => {
    setMap(readFromStorage());
    setHydrated(true);

    // Sledujeme změny i z jiných záložek/oken.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setMap(readFromStorage());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((key: string, patch: NavCustomization) => {
    setMap((prev) => {
      const next = { ...prev };
      const merged = { ...(next[key] ?? {}), ...patch };
      // Pokud je úplně prázdné, klíč odstraníme.
      if (!merged.label && !merged.icon) {
        delete next[key];
      } else {
        next[key] = merged;
      }
      writeToStorage(next);
      return next;
    });
  }, []);

  const setLabel = useCallback(
    (key: string, label: string | undefined) => {
      const trimmed = label?.trim();
      update(key, { label: trimmed ? trimmed : undefined });
    },
    [update],
  );

  const setIcon = useCallback(
    (key: string, icon: IconKey | undefined) => {
      update(key, { icon });
    },
    [update],
  );

  const reset = useCallback((key: string) => {
    setMap((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      writeToStorage(next);
      return next;
    });
  }, []);

  const get = useCallback(
    (key: string): NavCustomization => map[key] ?? {},
    [map],
  );

  return { get, setLabel, setIcon, reset, hydrated };
}
