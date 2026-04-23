'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/src/lib/supabase';
import { useTheme } from '@/src/components/ThemeProvider';

// --- Icons (inline lucide-react strokes, no dep) ----------------------------
const IconFeed = () => (
  <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 11a9 9 0 0 1 9 9" />
    <path d="M4 4a16 16 0 0 1 16 16" />
    <circle cx="5" cy="19" r="1" />
  </svg>
);

const IconArchive = () => (
  <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </svg>
);

const IconSettings = () => (
  <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconLogout = () => (
  <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconSun = () => (
  <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const IconMoon = () => (
  <svg className="sidebar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconMenu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: () => JSX.Element;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/feed', label: 'Feed', icon: IconFeed },
  { href: '/archive', label: 'Archiv', icon: IconArchive },
  { href: '/settings', label: 'Nastavení', icon: IconSettings, adminOnly: true },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      console.log('[protected] auth check start');

      // Bezpečnostní timeout — když se getSession nevrátí do 4s,
      // předpokládáme že session není a pošleme uživatele na /login.
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
      const sessionPromise = supabase.auth.getSession().then((r) => r.data.session);

      try {
        const session = await Promise.race([sessionPromise, timeout]);
        if (cancelled) return;

        console.log('[protected] session resolved', { hasSession: !!session, userId: session?.user?.id });

        if (!session) {
          console.log('[protected] no session, redirecting to /login');
          router.replace('/login');
          return;
        }
        setIsAuth(true);
        setUserEmail(session.user.email ?? '');
        setIsAdmin((session.user.user_metadata as { role?: string })?.role === 'admin');
        setIsLoading(false);
      } catch (err) {
        console.error('[protected] auth check failed', err);
        if (!cancelled) router.replace('/login');
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  // close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        <p>Načítám...</p>
      </div>
    );
  }

  if (!isAuth) return null;

  const avatarInitial = userEmail.charAt(0).toUpperCase() || '?';

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setSidebarOpen(true)}
        aria-label="Otevřít menu"
      >
        <IconMenu />
      </button>

      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="app-shell">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <h1>Checknito</h1>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section">Přehled</div>
            {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + '/');
              const IconComp = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? 'active' : ''}`}
                >
                  <IconComp />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <button className="theme-toggle" onClick={toggle} aria-label="Přepnout motiv">
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
              <span>{theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}</span>
            </button>

            <div className="sidebar-user">
              <div className="sidebar-user-avatar">{avatarInitial}</div>
              <div className="sidebar-user-email" title={userEmail}>
                {userEmail}
              </div>
            </div>

            <button
              className="sidebar-link"
              onClick={handleLogout}
              style={{ color: 'var(--text-muted)' }}
            >
              <IconLogout />
              <span>Odhlásit se</span>
            </button>
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </>
  );
}
