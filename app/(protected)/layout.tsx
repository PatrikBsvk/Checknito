'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/src/lib/supabase';
import { IconKey, NAV_ICONS } from '@/src/lib/nav-icons';
import { useNavCustomization } from '@/src/lib/use-nav-customization';
import NavItemControls from '@/src/components/NavItemControls';
import UserMenu from '@/src/components/UserMenu';
import { deriveDisplayName } from '@/src/lib/user';

// --- Pevné systémové ikony (nejsou součástí nav-icons, slouží jen pro UI) ---
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
  icon: IconKey;      // klíč do NAV_ICONS (nikoliv komponenta)
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/feed', label: 'Feed', icon: 'feed' },
  { href: '/archive', label: 'Archiv', icon: 'archive' },
  { href: '/settings', label: 'Nastavení', icon: 'settings', adminOnly: true },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // KLÍČOVÉ: jeden klient na celý life cycle komponenty — jinak createClient()
  // vrátí novou instanci při každém renderu → useEffect se re-runne donekonečna
  // a auth check se pořád cancelne dřív než stihne nastavit state.
  const supabase = useMemo(() => createClient(), []);

  // Uživatelská personalizace sidebaru (label + ikona)
  const { get, setLabel, setIcon, reset } = useNavCustomization();

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
        setDisplayName(deriveDisplayName(session.user));
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
              const override = get(item.href);
              const effectiveLabel = override.label ?? item.label;
              const effectiveIcon: IconKey = override.icon ?? item.icon;
              const IconRender = NAV_ICONS[effectiveIcon].render;

              return (
                <div key={item.href} className={`sidebar-link-row ${active ? 'active' : ''}`}>
                  <Link
                    href={item.href}
                    className={`sidebar-link ${active ? 'active' : ''}`}
                  >
                    <IconRender />
                    <span>{effectiveLabel}</span>
                  </Link>
                  <NavItemControls
                    currentLabel={effectiveLabel}
                    currentIcon={effectiveIcon}
                    defaultLabel={item.label}
                    defaultIcon={item.icon}
                    onRename={(label) => setLabel(item.href, label)}
                    onChangeIcon={(icon) => setIcon(item.href, icon)}
                    onReset={() => reset(item.href)}
                  />
                </div>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <UserMenu
              displayName={displayName || userEmail}
              email={userEmail}
              onLogout={handleLogout}
              onNameChanged={(newName) => {
                // Když se jméno vymaže, spadneme zpět na odvozené z emailu
                setDisplayName(
                  newName || deriveDisplayName({ email: userEmail, user_metadata: {} }),
                );
              }}
            />
          </div>
        </aside>

        <main className="main">{children}</main>
      </div>
    </>
  );
}
