'use client';

import { useState, useEffect } from 'react';
import { Operator } from '@/src/types';
import { addOperator, deleteOperator, subscribeToOperators } from '@/src/lib/supabase-service';
import Toast from './Toast';

interface OperatorManagerProps {
  operators: Operator[];
  onOperatorsChange: () => void;
}

export default function OperatorManager({
  operators: initialOperators,
  onOperatorsChange,
}: OperatorManagerProps) {
  const [operators, setOperators] = useState(initialOperators);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [newOperatorNumber, setNewOperatorNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Když parent dodá nové operátory (např. po refreshOperators po otevření modalu),
  // sesyncujeme lokální seznam.
  useEffect(() => {
    setOperators(initialOperators);
  }, [initialOperators]);

  useEffect(() => {
    const subscription = subscribeToOperators(
      (newOperator) => {
        // Dedup: pokud jsme operátora už přidali optimisticky po insertu, neduplikuj ho
        setOperators((prev) =>
          prev.some((op) => op.id === newOperator.id) ? prev : [...prev, newOperator]
        );
      },
      (id) => {
        setOperators((prev) => prev.filter((op) => op.id !== id));
      }
    );

    return () => {
      subscription.then((sub) => sub?.unsubscribe());
    };
  }, []);

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = newOperatorName.trim();
    const personal_number = newOperatorNumber.trim();

    if (!name) {
      setToast({ type: 'error', message: 'Zadejte jméno operátora!' });
      return;
    }

    setIsLoading(true);

    try {
      const newOp = await addOperator({ name, personal_number: personal_number || null });
      // Optimisticky přidat do lokálního seznamu — uživatel vidí změnu hned,
      // bez nutnosti čekat na realtime postgres_changes (které někdy nestihne).
      setOperators((prev) =>
        prev.some((op) => op.id === newOp.id) ? prev : [...prev, newOp]
      );
      setToast({ type: 'success', message: 'Operátor přidán!' });
      setNewOperatorName('');
      setNewOperatorNumber('');
      onOperatorsChange();
    } catch (error) {
      console.error('Error:', error);
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Chyba při přidávání!',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOperator = async (id: string) => {
    if (!confirm('Opravdu smazat operátora?')) return;

    setIsLoading(true);

    try {
      await deleteOperator(id);
      setToast({ type: 'success', message: 'Operátor smazán!' });
      setOperators((prev) => prev.filter((op) => op.id !== id));
      onOperatorsChange();
    } catch (error) {
      console.error('Error:', error);
      setToast({ type: 'error', message: 'Chyba při mazání!' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-section">
      <h2>Správa operátorů</h2>

      <form onSubmit={handleAddOperator} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Jméno"
            value={newOperatorName}
            onChange={(e) => setNewOperatorName(e.target.value)}
            disabled={isLoading}
            style={{ flex: '2 1 200px', minWidth: 0 }}
          />
          <input
            type="text"
            placeholder="Osobní číslo"
            value={newOperatorNumber}
            onChange={(e) => setNewOperatorNumber(e.target.value)}
            disabled={isLoading}
            style={{ flex: '1 1 140px', minWidth: 0 }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
          >
            Přidat
          </button>
        </div>
      </form>

      <div>
        <h3>Seznam operátorů</h3>
        {operators.length === 0 ? (
          <p>Žádní operátoři.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Jméno</th>
                  <th>Osobní číslo</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr key={op.id}>
                    <td>{op.name}</td>
                    <td style={{ color: op.personal_number ? 'var(--text)' : 'var(--text-muted)' }}>
                      {op.personal_number || '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeleteOperator(op.id)}
                        className="btn-sm btn-danger"
                        disabled={isLoading}
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
