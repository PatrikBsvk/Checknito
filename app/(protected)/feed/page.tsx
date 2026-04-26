'use client';

import { useEffect, useState, useCallback } from 'react';
import TransmissionForm from '@/src/components/TransmissionForm';
import TransmissionTable from '@/src/components/TransmissionTable';
import SearchBar from '@/src/components/SearchBar';
import FilterToggle from '@/src/components/FilterToggle';
import ExportButton from '@/src/components/ExportButton';
import PageTitle from '@/src/components/PageTitle';
import { Transmission, Operator } from '@/src/types';
import {
  getOperators,
  getRecentTransmissions,
  subscribeToTransmissions,
} from '@/src/lib/supabase-service';

export default function FeedPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [transmissions, setTransmissions] = useState<Transmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOwn, setOnlyOwn] = useState(false);

  const loadTransmissions = useCallback(async () => {
    const data = await getRecentTransmissions(onlyOwn, searchQuery);
    setTransmissions(data);
  }, [onlyOwn, searchQuery]);

  useEffect(() => {
    const init = async () => {
      const ops = await getOperators();
      setOperators(ops);
      await loadTransmissions();
      setIsLoading(false);
    };
    init();
  }, [loadTransmissions]);

  useEffect(() => {
    const subscription = subscribeToTransmissions(
      (newTransmission) => {
        setTransmissions((prev) => [newTransmission, ...prev]);
      },
      (id) => {
        setTransmissions((prev) => prev.filter((tx) => tx.id !== id));
      }
    );
    return () => {
      subscription.then((sub) => sub?.unsubscribe());
    };
  }, []);

  useEffect(() => {
    loadTransmissions();
  }, [onlyOwn, searchQuery, loadTransmissions]);

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)' }}>Načítám...</p>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <PageTitle fallback="Feed" />
          <p>Transmise za posledních 7 dní</p>
        </div>
      </div>

      <TransmissionForm
        operators={operators}
        onSuccess={loadTransmissions}
        lastTransmission={transmissions[0]}
      />

      <div className="card">
        <div className="page-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2>Eskalační feed</h2>
          </div>
          <ExportButton transmissions={transmissions} />
        </div>

        <div className="filter-bar">
          <SearchBar onSearch={setSearchQuery} placeholder="Hledat podle čísla nebo operátora..." />
          <FilterToggle onToggle={setOnlyOwn} initialValue={onlyOwn} />
        </div>

        <TransmissionTable transmissions={transmissions} onDelete={loadTransmissions} />
      </div>
    </div>
  );
}
