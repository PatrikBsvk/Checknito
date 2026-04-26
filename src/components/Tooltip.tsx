'use client';

import { useEffect, useRef, useState } from 'react';

interface TooltipProps {
  /** Obsah tooltipu (text, co se ukáže v bublině). Může obsahovat `\n` pro víceřádkový text. */
  content: string;
  /** Prvek, na který se tooltip váže (co je vidět v buňce). */
  children: React.ReactNode;
  /** Umístění vůči triggeru. Default "top". */
  placement?: 'top' | 'bottom';
}

/**
 * Tooltip s hover i click chováním — klik je hlavně pro mobily, kde hover neexistuje.
 *
 * - Hover: ukáže při najetí, zmizí při opuštění.
 * - Klik: toggluje pinned stav (zůstane otevřený, dokud neklikneš mimo nebo nestiskneš Esc).
 */
export default function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  const open = hovered || pinned;
  // Auto-detekce: pokud obsah obsahuje `\n`, render jako víceřádkový.
  const isMultiline = content.includes('\n');

  // Click-outside zavře pinned stav
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinned]);

  // Escape zavře pinned stav
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pinned]);

  return (
    <span
      ref={wrapRef}
      className="tooltip-wrap"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setPinned((v) => !v);
      }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`tooltip-bubble tooltip-${placement}${isMultiline ? ' tooltip-multiline' : ''}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
