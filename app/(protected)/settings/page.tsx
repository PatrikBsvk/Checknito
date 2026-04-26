'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/src/lib/supabase';
import OperatorManager from '@/src/components/OperatorManager';
import ProfileSettings from '@/src/components/ProfileSettings';
import PageTitle from '@/src/components/PageTitle';
import { Operator } from '@/src/types';
import { getOperators } from '@/src/lib/supabase-service';

export default function SettingsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session?.user?.user_metadata?.role === 'admin') {
        setIsAdmin(true);
        const ops = await getOperators();
        setOperators(ops);
      } else {
        setIsAdmin(false);
      }

      setIsLoading(false);
    };

    checkAdmin();
  }, [supabase]);

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)' }}>Načítám...</p>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <PageTitle fallback="Nastavení" />
          <p>Správa profilu a aplikace</p>
        </div>
      </div>

      {/* Profil je dostupný všem přihlášeným uživatelům */}
      <ProfileSettings />

      {/* Správa operátorů pouze pro adminy */}
      {isAdmin ? (
        <OperatorManager
          operators={operators}
          onOperatorsChange={async () => {
            const ops = await getOperators();
            setOperators(ops);
          }}
        />
      ) : (
        <div className="card">
          <div className="empty-state">
            <strong>Správa operátorů</strong>
            <p>Tato sekce je dostupná pouze administrátorům.</p>
          </div>
        </div>
      )}
    </div>
  );
}
