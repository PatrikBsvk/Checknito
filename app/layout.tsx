import type { Metadata } from 'next';
import { ThemeProvider } from '@/src/components/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Checknito',
  description: 'PWA pro správu transmisí a eskalační feed',
  manifest: '/manifest.json',
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
            __html: `if ("serviceWorker" in navigator) { navigator.serviceWorker.register("/sw.js").catch(() => {}); }`,
          }}
        />
      </body>
    </html>
  );
}
