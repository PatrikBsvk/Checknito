'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/lib/supabase';
import Toast from '@/src/components/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const router = useRouter();
  // Stabilní instance — aby useEffect nejezdil dokola při každém renderu.
  const supabase = useMemo(() => createClient(), []);

  // Když už jsi přihlášený, rovnou odeženeme na feed
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log('[login] existing session found, redirecting to /feed');
        router.replace('/feed');
      }
    };
    check();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[login] submit', { mode, email });
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('[login] signInWithPassword result', { hasSession: !!data?.session, error });
        if (error) {
          setToast({ type: 'error', message: error.message });
          setIsLoading(false);
          return;
        }
        setToast({ type: 'success', message: 'Přihlášení úspěšné — přesměrovávám…' });
        // tvrdý refresh, aby se Server Componenty znovu načetly s novou session
        window.location.href = '/feed';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setToast({ type: 'error', message: error.message });
          setIsLoading(false);
          return;
        }
        setToast({
          type: 'success',
          message: 'Registrace úspěšná! Zkontroluj email pro potvrzení.',
        });
        setEmail('');
        setPassword('');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[login] unexpected error', err);
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Neočekávaná chyba',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2>Checknito</h2>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Přihlaš se ke svému účtu' : 'Vytvoř si nový účet'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              placeholder="tvuj@email.cz"
            />
          </div>

          <div className="form-group">
            <label>Heslo</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Načítám...' : mode === 'login' ? 'Přihlásit se' : 'Registrovat se'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>
              Ještě nemáš účet?{' '}
              <a onClick={() => setMode('signup')} style={{ cursor: 'pointer' }}>
                Registrovat se
              </a>
            </>
          ) : (
            <>
              Už máš účet?{' '}
              <a onClick={() => setMode('login')} style={{ cursor: 'pointer' }}>
                Přihlásit se
              </a>
            </>
          )}
        </div>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} />}
    </div>
  );
}
