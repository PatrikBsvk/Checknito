'use client';

import { useState } from 'react';
import { Transmission } from '@/src/types';
import {
  deleteTransmission,
  archiveTransmission,
  restoreTransmission,
} from '@/src/lib/supabase-service';
import Toast from './Toast';

interface TransmissionTableProps {
  transmissions: Transmission[];
  isArchive?: boolean;
  onDelete: () => void;
}

export default function TransmissionTable({
  transmissions,
  isArchive = false,
  onDelete,
}: TransmissionTableProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu smazat?')) return;
    setIsLoading(true);
    try {
      await deleteTransmission(id);
      setToast({ type: 'success', message: 'Transmise smazána!' });
      onDelete();
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Chyba při mazání!' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async (id: string) => {
    setIsLoading(true);
    try {
      await archiveTransmission(id);
      setToast({ type: 'success', message: 'Transmise archivována!' });
      onDelete();
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Chyba při archivování!' });
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
              <th>Operátor</th>
              <th>Čas hotovo</th>
              <th>Chyby</th>
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
                <td>{tx.operators?.name || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {new Date(tx.completed_at).toLocaleString('cs-CZ')}
                </td>
                <td>
                  {tx.has_errors ? (
                    <span className="badge badge-error">
                      Ano
                      {Array.isArray(tx.errors) && tx.errors.length > 0 ? ` (${tx.errors.length})` : ''}
                    </span>
                  ) : (
                    <span className="badge badge-success">Ne</span>
                  )}
                </td>
                <td>
                  <div className="photo-thumbs">
                    {tx.photo_left && (
                      <img
                        src={tx.photo_left}
                        alt="Levá"
                        onClick={() => setModalImage(tx.photo_left)}
                        title="Levá fotka"
                      />
                    )}
                    {tx.photo_right && (
                      <img
                        src={tx.photo_right}
                        alt="Pravá"
                        onClick={() => setModalImage(tx.photo_right)}
                        title="Pravá fotka"
                      />
                    )}
                  </div>
                </td>
                <td>
                  <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                    {!isArchive && (
                      <button
                        onClick={() => handleArchive(tx.id)}
                        className="btn-sm"
                        disabled={isLoading}
                      >
                        Archivovat
                      </button>
                    )}
                    {isArchive && (
                      <button
                        onClick={() => handleRestore(tx.id)}
                        className="btn-sm btn-success"
                        disabled={isLoading}
                      >
                        Obnovit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="btn-sm btn-danger"
                      disabled={isLoading}
                    >
                      Smazat
                    </button>
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
