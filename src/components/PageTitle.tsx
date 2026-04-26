'use client';

import { usePathname } from 'next/navigation';
import { useNavCustomization } from '@/src/lib/use-nav-customization';

interface PageTitleProps {
  /** Výchozí název stránky — použije se, pokud uživatel nepřejmenoval. */
  fallback: string;
  /** Volitelný override cesty (standardně se použije aktuální pathname). */
  pathKey?: string;
}

/**
 * H1 s respektem k uživatelské personalizaci sidebaru.
 *
 * Sidebar ukládá přejmenování pod klíč = href (např. "/feed").
 * PageTitle čte ze stejného úložiště, takže když uživatel přejmenuje
 * položku na "Checklist - CTL", nadpis stránky se změní taky.
 */
export default function PageTitle({ fallback, pathKey }: PageTitleProps) {
  const pathname = usePathname();
  const { get } = useNavCustomization();
  const key = pathKey ?? pathname ?? '';
  const label = key ? get(key).label : undefined;
  return <h1>{label ?? fallback}</h1>;
}
