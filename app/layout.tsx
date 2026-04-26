import type { Metadata } from 'next';
import { ThemeProvider } from '@/src/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Checknito',
  description: 'PWA pro správu transmisí a eskalační feed',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Checknito',
    statusBarStyle: 'black-translucent',
  },
};

// Inline script to apply theme BEFORE React hydrates — avoids flash of wrong theme.
const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" data-theme="light">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        {/* iOS PWA podpora — Safari nepoužívá manifest.json icons, potřebuje apple-touch-icon. */}
        <link
          rel="apple-touch-icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect fill='%230072CE' width='180' height='180' rx='38'/%3E%3Ctext x='50%25' y='50%25' font-size='100' fill='white' text-anchor='middle' dominant-baseline='central' font-family='Arial' font-weight='700'%3EC%3C/text%3E%3C/svg%3E"
        />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0072CE" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.register("/sw.js").then(function(reg) {
                  // Při každém načtení stránky zkus zjistit, jestli je nová verze SW.
                  // Když najde novou, prohlížeč ji stáhne a aktivuje (skipWaiting v sw.js).
                  reg.update().catch(function(){});

                  // Když nový SW skončí v "waiting" (např. na desktopu kde už běží tab),
                  // pošli mu zprávu ať skipne čekání a převezme řízení.
                  if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
                  reg.addEventListener("updatefound", function() {
                    var nw = reg.installing;
                    if (!nw) return;
                    nw.addEventListener("statechange", function() {
                      if (nw.state === "installed" && navigator.serviceWorker.controller) {
                        // Nová verze hotová — vynutíme reload aby uživatel hned dostal update.
                        nw.postMessage("SKIP_WAITING");
                      }
                    });
                  });
                }).catch(function(){});

                // Když se controller změní (nový SW převzal řízení), reloadni stránku
                // — stará verze by jinak dál servírovala starou cached HTML.
                var refreshing = false;
                navigator.serviceWorker.addEventListener("controllerchange", function() {
                  if (refreshing) return;
                  refreshing = true;
                  window.location.reload();
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
