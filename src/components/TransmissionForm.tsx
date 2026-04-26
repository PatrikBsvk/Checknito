'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Operator,
  ERROR_TYPES,
  ErrorTypeCode,
  Transmission,
  TRANSMISSION_MODELS,
  TransmissionModel,
  formatErrorEntry,
} from '@/src/types';
import { addOperator, createTransmission, uploadPhoto } from '@/src/lib/supabase-service';
import { compressImage } from '@/src/lib/image-compress';
import Toast from './Toast';

interface TransmissionFormProps {
  operators: Operator[];
  onSuccess: () => void;
  /** Nejnovější transmise — použije se pro předvyplnění čísla (+1) a operátora. */
  lastTransmission?: Transmission;
}

// --- Ikony ----------------------------------------------------------------

const IconCamera = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconImage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

// -------- Sub-komponenta: input na fotku (Vyfotit vs. Z galerie) ---------
//
// Na mobilu `capture="environment"` otevře zadní foťák rovnou.
// Na desktopu je `capture` ignorovaný → chová se jako klasický file picker,
// takže bez speciálních větví funguje všude.

interface PhotoInputProps {
  label: string;
  file: File | null;
  onChange: (file: File) => void;
  disabled?: boolean;
}

function PhotoInput({ label, file, onChange, disabled }: PhotoInputProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onChange(f);
    // reset value, aby šlo vybrat stejný soubor znovu (po chybě apod.)
    e.target.value = '';
  };

  return (
    <div className="form-group">
      <label>{label} *</label>
      <div className="photo-input-row">
        <button
          type="button"
          className="btn-photo"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
          aria-label={`Vyfotit — ${label}`}
        >
          <IconCamera />
          <span>Vyfotit</span>
        </button>
        <button
          type="button"
          className="btn-photo"
          onClick={() => galleryRef.current?.click()}
          disabled={disabled}
          aria-label={`Z galerie — ${label}`}
        >
          <IconImage />
          <span>Z galerie</span>
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handle}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handle}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      {file && (
        <small style={{ display: 'block', marginTop: '0.4rem', color: 'var(--text-muted)' }}>
          ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
        </small>
      )}
    </div>
  );
}

/**
 * Vezme "T-12345" a vrátí "T-12346". Zvládá:
 *   - prefix libovolného textu (T-, #, apod.)
 *   - leading zeros (padStart zachová šířku)
 * Pokud není žádné trailing číslo, vrací prázdný string (radši nic než blbost).
 */
const incrementNumber = (s: string): string => {
  const match = s.match(/^(.*?)(\d+)$/);
  if (!match) return '';
  const [, prefix, digits] = match;
  const width = digits.length;
  const next = (Number(digits) + 1).toString().padStart(width, '0');
  return `${prefix}${next}`;
};

/** Stav každého typu vady: zaškrtnuto + volitelná čísla svárů. */
type ErrorSelection = { checked: boolean; numbers: string };
type ErrorSelections = Record<ErrorTypeCode, ErrorSelection>;

/** Prázdná struktura — všech 9 typů unchecked, žádná čísla. */
const emptyErrorSelections = (): ErrorSelections => {
  const obj = {} as ErrorSelections;
  ERROR_TYPES.forEach((t) => {
    obj[t.code] = { checked: false, numbers: '' };
  });
  return obj;
};

export default function TransmissionForm({
  operators,
  onSuccess,
  lastTransmission,
}: TransmissionFormProps) {
  const [formData, setFormData] = useState(() => ({
    transmission_number: lastTransmission
      ? incrementNumber(lastTransmission.transmission_number)
      : '',
    model: '' as TransmissionModel | '',
    operator_id: lastTransmission?.operator_id ?? '',
    completed_at: '',
    carts_missing: false,
    has_errors: false,
    errorSelections: emptyErrorSelections(),
  }));

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

  const toggleErrorType = (code: ErrorTypeCode) => {
    setFormData((prev) => ({
      ...prev,
      errorSelections: {
        ...prev.errorSelections,
        [code]: {
          ...prev.errorSelections[code],
          checked: !prev.errorSelections[code].checked,
        },
      },
    }));
  };

  const setErrorNumbers = (code: ErrorTypeCode, numbers: string) => {
    setFormData((prev) => ({
      ...prev,
      errorSelections: {
        ...prev.errorSelections,
        [code]: { ...prev.errorSelections[code], numbers },
      },
    }));
  };

  const handleFilePicked = (file: File, side: 'left' | 'right') => {
    // 25 MB horní strop — jen ochrana proti úplně šíleným souborům
    // (RAW, 4K videa apod.). Normální fotka z mobilu má 2–8 MB a my
    // ji během uploadu zkomprimujeme na ~500 kB.
    if (file.size > 25 * 1024 * 1024) {
      setToast({ type: 'error', message: 'Foto je větší než 25 MB!' });
      return;
    }
    setFiles((prev) => ({ ...prev, [side]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validace
    if (!formData.transmission_number) {
      setToast({ type: 'error', message: 'Zadejte číslo transmise!' });
      return;
    }
    if (!formData.model) {
      setToast({ type: 'error', message: 'Vyberte model!' });
      return;
    }
    if (!formData.operator_id) {
      setToast({ type: 'error', message: 'Vyberte operátora!' });
      return;
    }
    // Čas hotovo je povinný POUZE když jsou „Chybí vozíky" zaškrtnuté.
    if (formData.carts_missing && !formData.completed_at) {
      setToast({ type: 'error', message: 'Zadejte čas hotovo!' });
      return;
    }
    if (!files.left || !files.right) {
      setToast({ type: 'error', message: 'Nahrajte obě fotky!' });
      return;
    }

    setIsLoading(true);

    try {
      // Paralelní komprese obou fotek — každá se resizne na max 1600 px
      // delší strany a re-enkóduje do JPEG q=0.82. Typická 6 MB fotka
      // z mobilu skončí na ~500–800 kB.
      const [leftCompressed, rightCompressed] = await Promise.all([
        compressImage(files.left),
        compressImage(files.right),
      ]);

      const [photoLeft, photoRight] = await Promise.all([
        uploadPhoto(leftCompressed),
        uploadPhoto(rightCompressed),
      ]);

      // Když chyběly vozíky → completed_at = dnešek + zadaný HH:MM.
      // Jinak → null (všechno bylo v pořádku, čas odeslání už je v created_at).
      let completedAtISO: string | null = null;
      if (formData.carts_missing && formData.completed_at) {
        const [hours, minutes] = formData.completed_at.split(':').map(Number);
        const completedDate = new Date();
        completedDate.setHours(hours, minutes, 0, 0);
        completedAtISO = completedDate.toISOString();
      }

      // Serializace error selections → pole stringů pro DB.
      // Jen checked typy; zachovává pořadí A..I.
      const serializedErrors = formData.has_errors
        ? ERROR_TYPES
            .filter((t) => formData.errorSelections[t.code].checked)
            .map((t) =>
              formatErrorEntry(t.code, formData.errorSelections[t.code].numbers),
            )
        : [];

      await createTransmission({
        transmission_number: formData.transmission_number,
        model: formData.model,
        operator_id: formData.operator_id,
        completed_at: completedAtISO,
        carts_missing: formData.carts_missing,
        has_errors: formData.has_errors,
        errors: serializedErrors,
        photo_left: photoLeft,
        photo_right: photoRight,
      });

      setToast({ type: 'success', message: 'Transmise uložena!' });

      // Reset: číslo += 1, operátor zůstává (většinou dělá stejný dál).
      // Model, chyby, vozíky a fotky vyprázdnit — ty se u každé transmise zadávají znovu.
      setFormData((prev) => ({
        transmission_number: incrementNumber(prev.transmission_number),
        model: '',
        operator_id: prev.operator_id,
        completed_at: '',
        carts_missing: false,
        has_errors: false,
        errorSelections: emptyErrorSelections(),
      }));
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
          <label>Model *</label>
          <div className="model-toggle-group" role="radiogroup" aria-label="Model transmise">
            {TRANSMISSION_MODELS.map((m) => {
              const active = formData.model === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`model-toggle ${active ? 'active' : ''}`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, model: active ? '' : m }))
                  }
                  disabled={isLoading}
                >
                  {m}
                </button>
              );
            })}
          </div>
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
          <label className="checkbox-group">
            <input
              type="checkbox"
              name="has_errors"
              checked={formData.has_errors}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <span>Typy vad?</span>
          </label>
        </div>

        {formData.has_errors && (
          <div className="error-list">
            {ERROR_TYPES.map((type) => {
              const sel = formData.errorSelections[type.code];
              return (
                <div key={type.code} className="error-item">
                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={sel.checked}
                      onChange={() => toggleErrorType(type.code)}
                      disabled={isLoading}
                    />
                    <span>
                      {type.code}) {type.label}
                    </span>
                  </label>
                  {sel.checked && (
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="čísla svárů, např. 4,5,10"
                      value={sel.numbers}
                      onChange={(e) => setErrorNumbers(type.code, e.target.value)}
                      disabled={isLoading}
                      className="error-numbers-input"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-group">
            <input
              type="checkbox"
              name="carts_missing"
              checked={formData.carts_missing}
              onChange={handleInputChange}
              disabled={isLoading}
            />
            <span>Chybí vozíky?</span>
          </label>
        </div>

        {formData.carts_missing && (
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
        )}

        <PhotoInput
          label="Fotka levá"
          file={files.left}
          onChange={(f) => handleFilePicked(f, 'left')}
          disabled={isLoading}
        />

        <PhotoInput
          label="Fotka pravá"
          file={files.right}
          onChange={(f) => handleFilePicked(f, 'right')}
          disabled={isLoading}
        />

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
