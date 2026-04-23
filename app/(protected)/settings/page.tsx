'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/src/lib/supabase';
import OperatorManager from '@/src/components/OperatorManager';
import { Operator } from '@/src/types';
import { getOperators } from '@/src/lib/supabase-service';

export default function SettingsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session?.user?.user_metadata?.role) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      if (sessionData.session.user.user_metadata.role === 'admin') {
        setIsAdmin(true);
        const ops = await getOperators();
        setOperators(ops);
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
          <h1>Nastavení</h1>
          <p>Správa aplikace</p>
        </div>
      </div>

      {!isAdmin ? (
        <div className="card">
          <div className="empty-state">
            <strong>Přístup zamítnut</strong>
            <p>Tato sekce je dostupná pouze administrátorům.</p>
          </div>
        </div>
      ) : (
        <OperatorManager
          operators={operators}
          onOperatorsChange={async () => {
            const ops = await getOperators();
            setOperators(ops);
          }}
        />
      )}
    </div>
  );
}
