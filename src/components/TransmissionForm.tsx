'use client';

import { useEffect, useState } from 'react';
import { Operator, ERROR_TYPES } from '@/src/types';
import { addOperator, createTransmission, uploadPhoto } from '@/src/lib/supabase-service';
import Toast from './Toast';

interface TransmissionFormProps {
  operators: Operator[];
  onSuccess: () => void;
}

export default function TransmissionForm({
  operators,
  onSuccess,
}: TransmissionFormProps) {
  const [formData, setFormData] = useState({
    transmission_number: '',
    operator_id: '',
    completed_at: '',
    has_errors: false,
    errors: [] as string[],
  });

  const [files, setFiles] = useState<{ left: File | null; right: File | null }>({
    left: null,
    right: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Inline přidání operátora — ušetří klikání do Nastavení.
  const [localOperators, setLocalOperators] = useState<Operator[]>(operators);
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [newOperatorNumber, setNewOperatorNumber] = useState('');
  const [isAddingOperator, setIsAddingOperator] = useState(false);

  // Když parent přepošle novou verzi seznamu (po uložení transmise, realtime apod.),
  // sesyncujeme lokální kopii — ale jen pokud nejsme uprostřed přidávání.
  useEffect(() => {
    if (!isAddingOperator) setLocalOperators(operators);
  }, [operators, isAddingOperator]);

  const handleAddOperator = async () => {
    const name = newOperatorName.trim();
    const personal_number = newOperatorNumber.trim();
    if (!name) return;

    setIsAddingOperator(true);
    try {
      const created = await addOperator({ name, personal_number: personal_number || null });
      // Optimisticky přidat + rovnou vybrat.
      setLocalOperators((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, operator_id: created.id }));
      setNewOperatorName('');
      setNewOperatorNumber('');
      setShowAddOperator(false);
      setToast({ type: 'success', message: `Operátor "${created.name}" přidán.` });
    } catch (error) {
      console.error('Error adding operator:', error);
      const msg = error instanceof Error ? error.message : 'Nepodařilo se přidat operátora';
      // Hezčí hláška pro RLS error (permission denied).
      const friendly = msg.includes('row-level security') || msg.includes('permission')
        ? 'Nemáš oprávnění přidávat operátory (jen admin).'
        : msg;
      setToast({ type: 'error', message: friendly });
    } finally {
      setIsAddingOperator(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleErrorToggle = (errorType: string) => {
    setFormData((prev) => ({
      ...prev,
      errors: prev.errors.includes(errorType)
        ? prev.errors.filter((e) => e !== errorType)
        : [...prev.errors, errorType],
    }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    side: 'left' | 'right'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setToast({ type: 'error', message: 'Foto je větší než 5MB!' });
        return;
      }
      setFiles((prev) => ({ ...prev, [side]: file }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validace
    if (!formData.transmission_number) {
      setToast({ type: 'error', message: 'Zadejte číslo transmise!' });
      return;
    }
    if (!formData.operator_id) {
      setToast({ type: 'error', message: 'Vyberte operátora!' });
      return;
    }
    if (!formData.completed_at) {
      setToast({ type: 'error', message: 'Zadejte čas hotovo!' });
      return;
    }
    if (!files.left || !files.right) {
      setToast({ type: 'error', message: 'Nahrajte obě fotky!' });
      return;
    }

    setIsLoading(true);

    try {
      const photoLeft = await uploadPhoto(files.left);
      const photoRight = await uploadPhoto(files.right);

      // completed_at uložíme jako dnešní datum + zadaný HH:MM čas.
      // Pokud zadaný čas je v budoucnosti (např. zadám 23:30 v 23:45 dopoledne zítra),
      // tak to prostě uloží dnešní den — odpovídá workflow "zadáváš co už jsi dělal/a dnes".
      const [hours, minutes] = formData.completed_at.split(':').map(Number);
      const completedDate = new Date();
      completedDate.setHours(hours, minutes, 0, 0);

      await createTransmission({
        ...formData,
        completed_at: completedDate.toISOString(),
        photo_left: photoLeft,
        photo_right: photoRight,
      });

      setToast({ type: 'success', message: 'Transmise uložena!' });

      setFormData({
        transmission_number: '',
        operator_id: '',
        completed_at: '',
        has_errors: false,
        errors: [],
      });
      setFiles({ left: null, right: null });

      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Chyba při ukládání!',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-section">
      <h2>Přidat transmisi</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Číslo transmise *</label>
          <input
            type="text"
            name="transmission_number"
            value={formData.transmission_number}
            onChange={handleInputChange}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
            <label style={{ marginBottom: 0 }}>Operátor *</label>
            {!showAddOperator && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setShowAddOperator(true)}
                disabled={isLoading}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
              >
                + Nový operátor
              </button>
            )}
          </div>

          {showAddOperator ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={newOperatorName}
                onChange={(e) => setNewOperatorName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOperator();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowAddOperator(false);
                    setNewOperatorName('');
                    setNewOperatorNumber('');
                  }
                }}
                placeholder="Jméno"
                disabled={isAddingOperator}
                autoFocus
                style={{ flex: '2 1 160px', minWidth: 0 }}
              />
              <input
                type="text"
                value={newOperatorNumber}
                onChange={(e) => setNewOperatorNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOperator();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowAddOperator(false);
                    setNewOperatorName('');
                    setNewOperatorNumber('');
                  }
                }}
                placeholder="Osobní číslo"
                disabled={isAddingOperator}
                style={{ flex: '1 1 120px', minWidth: 0 }}
              />
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={handleAddOperator}
                disabled={isAddingOperator || !newOperatorName.trim()}
              >
                {isAddingOperator ? '...' : 'Přidat'}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  setShowAddOperator(false);
                  setNewOperatorName('');
                  setNewOperatorNumber('');
                }}
                disabled={isAddingOperator}
              >
                Zrušit
              </button>
            </div>
          ) : (
            <select
              name="operator_id"
              value={formData.operator_id}
              onChange={handleInputChange}
              required
              disabled={isLoading}
            >
              <option value="">-- Vyberte operátora --</option>
              {localOperators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.personal_number ? `${op.name} (${op.personal_number})` : op.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="form-group">
          <label>Čas hotovo *</label>
          <input
            type="time"
            name="completed_at"
            value={formData.completed_at}
            onChange={handleInputChange}
            required
            disabled={isLoading}
            placeholder="HH:MM"
          />
          <small style={{ color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
            Datum se doplní automaticky podle času uložení.
          </small>
        </div>

        <div className="form-group">
          <label className="checkbox-group">
            <input
              type="checkbox"
              name="has_errors"
              checked={formData.has_errors}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <span>Byly chyby?</span>
          </label>
        </div>

        {formData.has_errors && (
          <div className="error-list">
            {ERROR_TYPES.map((errorType) => (
              <div key={errorType} className="error-item">
                <input
                  type="checkbox"
                  id={errorType}
                  checked={formData.errors.includes(errorType)}
                  onChange={() => handleErrorToggle(errorType)}
                  disabled={isLoading}
                />
                <label htmlFor={errorType}>{errorType}</label>
              </div>
            ))}
          </div>
        )}

        <div className="form-group">
          <label>Fotka levá *</label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => handleFileChange(e, 'left')}
            required
            disabled={isLoading}
          />
          {files.left && <small>✓ {files.left.name}</small>}
        </div>

        <div className="form-group">
          <label>Fotka pravá *</label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => handleFileChange(e, 'right')}
            required
            disabled={isLoading}
          />
          {files.right && <small>✓ {files.right.name}</small>}
        </div>

        <button
          type="submit"
          className="btn-primary"
          style={{ width: '100%' }}
          disabled={isLoading}
        >
          {isLoading ? 'Ukládám...' : 'Uložit transmisi'}
        </button>
      </form>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
