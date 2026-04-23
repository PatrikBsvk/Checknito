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

    const data = transmissions.map((tx) => ({
      Číslo: tx.transmission_number,
      Operátor: tx.operators?.name || 'N/A',
      'Čas hotovo': new Date(tx.completed_at).toLocaleString('cs-CZ'),
      Chyby: tx.has_errors ? 'Ano' : 'Ne',
      Vytvořeno: new Date(tx.created_at).toLocaleString('cs-CZ'),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transmise');

    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 8 },
      { wch: 20 },
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
