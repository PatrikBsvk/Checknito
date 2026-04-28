'use client';

import { Transmission } from '@/src/types';
import * as XLSX from 'xlsx';

interface ExportButtonProps {
  transmissions: Transmission[];
}

export default function ExportButton({ transmissions }: ExportButtonProps) {
  const handleExport = () => {
    if (transmissions.length === 0) {
      alert('Žádné transmise k exportu!');
      return;
    }

    const data = transmissions.map((tx) => {
      // Zpoždění v minutách mezi completed_at (reálné hotovo) a created_at (odeslání).
      // Má smysl jen když chyběly vozíky → completed_at je vyplněný.
      let delayMinutes: number | string = '';
      if (tx.completed_at) {
        const diffMs = new Date(tx.created_at).getTime() - new Date(tx.completed_at).getTime();
        delayMinutes = Math.round(diffMs / 60000);
      }

      // Časy do Excelu vždy v pražském čase, bez ohledu na timezone exportujícího stroje.
      const tzOpts: Intl.DateTimeFormatOptions = { timeZone: 'Europe/Prague' };

      return {
        Číslo: tx.transmission_number,
        Model: tx.model || '',
        Operátor: tx.operators?.name || 'N/A',
        'Chybí vozíky': tx.carts_missing ? 'Ano' : 'Ne',
        'Čas hotovo': tx.completed_at
          ? new Date(tx.completed_at).toLocaleString('cs-CZ', tzOpts)
          : '',
        'Zpoždění (min)': delayMinutes,
        Chyby: tx.has_errors ? 'Ano' : 'Ne',
        Vytvořeno: new Date(tx.created_at).toLocaleString('cs-CZ', tzOpts),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transmise');

    worksheet['!cols'] = [
      { wch: 12 },   // Číslo
      { wch: 10 },   // Model
      { wch: 18 },   // Operátor
      { wch: 12 },   // Chybí vozíky
      { wch: 20 },   // Čas hotovo
      { wch: 14 },   // Zpoždění
      { wch: 8 },    // Chyby
      { wch: 20 },   // Vytvořeno
    ];

    XLSX.writeFile(workbook, `transmise_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <button onClick={handleExport} className="btn-secondary">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export do Excelu
    </button>
  );
}
