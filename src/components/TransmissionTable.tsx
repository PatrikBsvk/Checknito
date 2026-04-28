'use client';

import { useState } from 'react';
import { Transmission } from '@/src/types';
import {
  deleteTransmission,
  restoreTransmission,
} from '@/src/lib/supabase-service';
import Toast from './Toast';
import Tooltip from './Tooltip';

interface TransmissionTableProps {
  transmissions: Transmission[];
  isArchive?: boolean;
  onDelete: () => void;
}

// --- Ikony ----------------------------------------------------------------

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// --------------------------------------------------------------------------

// V buňce: jen "HH:MM". V tooltipu (hover): celé datum + čas se sekundama.
// `timeZone: 'Europe/Prague'` je klíčový — bez něj se čas zobrazí podle
// timezone stroje (telefon/PC) na kterém prohlížeč běží. Tohle drží
// pražský čas konzistentně bez ohledu na nastavení zařízení.
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

const formatFull = (iso: string) =>
  new Date(iso).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Prague',
  });

export default function TransmissionTable({
  transmissions,
  isArchive = false,
  onDelete,
}: TransmissionTableProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const handleDelete = async (tx: Transmission) => {
    const label = tx.transmission_number
      ? `transmisi ${tx.transmission_number}`
      : 'tuto transmisi';
    if (!confirm(`Opravdu chceš smazat ${label}? Tato akce je nevratná.`)) return;
    setIsLoading(true);
    try {
      await deleteTransmission(tx.id);
      setToast({ type: 'success', message: 'Transmise smazána!' });
      onDelete();
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Chyba při mazání!' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setIsLoading(true);
    try {
      await restoreTransmission(id);
      setToast({ type: 'success', message: 'Transmise obnovena!' });
      onDelete();
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Chyba při obnovování!' });
    } finally {
      setIsLoading(false);
    }
  };

  if (transmissions.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <strong>Žádné transmise</strong>
          <p>{isArchive ? 'Archiv je prázdný.' : 'Zatím nebyla přidána žádná transmise.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Číslo</th>
              <th>Model</th>
              <th>Operátor</th>
              <th>Typy vad</th>
              <th>Čas hotovo</th>
              <th>Uloženo</th>
              <th>Fotky</th>
              <th style={{ textAlign: 'right' }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {transmissions.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <strong>{tx.transmission_number}</strong>
                </td>
                <td>
                  {tx.model ? (
                    <span className="badge badge-model">{tx.model}</span>
                  ) : (
                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                  )}
                </td>
                <td>{tx.operators?.name || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                <td>
                  {tx.has_errors ? (
                    Array.isArray(tx.errors) && tx.errors.length > 0 ? (
                      <Tooltip content={tx.errors.join('\n')}>
                        <span className="badge badge-error">NOK</span>
                      </Tooltip>
                    ) : (
                      <span className="badge badge-error">NOK</span>
                    )
                  ) : (
                    <span className="badge badge-success">Ok</span>
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {tx.completed_at ? (
                    <Tooltip content={formatFull(tx.completed_at)}>
                      {formatTime(tx.completed_at)}
                    </Tooltip>
                  ) : (
                    <Tooltip content="Vozíky v pořádku">
                      <span className="badge badge-success">Vozíky OK</span>
                    </Tooltip>
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  <Tooltip content={formatFull(tx.created_at)}>
                    {formatTime(tx.created_at)}
                  </Tooltip>
                </td>
                <td>
                  <div className="photo-thumbs">
                    {tx.photo_left && (
                      <Tooltip content="Levá fotka">
                        <img
                          src={tx.photo_left}
                          alt="Levá"
                          onClick={() => setModalImage(tx.photo_left)}
                        />
                      </Tooltip>
                    )}
                    {tx.photo_right && (
                      <Tooltip content="Pravá fotka">
                        <img
                          src={tx.photo_right}
                          alt="Pravá"
                          onClick={() => setModalImage(tx.photo_right)}
                        />
                      </Tooltip>
                    )}
                  </div>
                </td>
                <td>
                  <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                    {isArchive && (
                      <button
                        onClick={() => handleRestore(tx.id)}
                        className="btn-sm btn-success"
                        disabled={isLoading}
                      >
                        Obnovit
                      </button>
                    )}
                    <Tooltip content="Smazat">
                      <button
                        onClick={() => handleDelete(tx)}
                        className="btn-icon-danger"
                        disabled={isLoading}
                        aria-label="Smazat"
                      >
                        <IconTrash />
                      </button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalImage && (
        <div className="modal active" onClick={() => setModalImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalImage(null)} aria-label="Zavřít">
              ×
            </button>
            <img
              src={modalImage}
              alt="Foto"
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 'var(--radius-md)' }}
            />
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} />}
    </>
  );
}
