'use client';

import { useEffect, useState, useCallback } from 'react';
import TransmissionTable from '@/src/components/TransmissionTable';
import SearchBar from '@/src/components/SearchBar';
import FilterToggle from '@/src/components/FilterToggle';
import ExportButton from '@/src/components/ExportButton';
import { Transmission } from '@/src/types';
import { getTransmissions } from '@/src/lib/supabase-service';

export default function ArchivePage() {
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOwn, setOnlyOwn] = useState(false);

  const loadTransmissions = useCallback(async () => {
    const data = await getTransmissions(true, onlyOwn, searchQuery);
    setTransmissions(data);
  }, [onlyOwn, searchQuery]);

  useEffect(() => {
    const init = async () => {
      await loadTransmissions();
      setIsLoading(false);
    };
    init();
  }, [loadTransmissions]);

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)' }}>Načítám...</p>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Archiv</h1>
          <p>Archivované transmise</p>
        </div>
        <ExportButton transmissions={transmissions} />
      </div>

      <div className="card">
        <div className="filter-bar">
          <SearchBar onSearch={setSearchQuery} placeholder="Hledat podle čísla nebo operátora..." />
          <FilterToggle onToggle={setOnlyOwn} initialValue={onlyOwn} />
        </div>

        <TransmissionTable
          transmissions={transmissions}
          isArchive={true}
          onDelete={loadTransmissions}
        />
      </div>
    </div>
  );
}
