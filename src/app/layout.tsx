import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "NEET 2027 Study Tracker",
  description: "Complete preparation ecosystem for NEET 2027 aspirants — plan, track, analyze, recall.",
  keywords: ["NEET", "study tracker", "PWA", "focus timer", "spaced repetition"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon-32.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NEET 2027',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0b15',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var raw = localStorage.getItem('neet-settings');
                  var theme = 'dark';
                  if (raw) {
                    var parsed = JSON.parse(raw);
                    theme = parsed?.state?.appTheme || 'dark';
                  }
                  var el = document.documentElement;
                  el.classList.remove('dark', 'warm', 'ocean', 'forest', 'lavender', 'rose', 'gold', 'light-mode-adapt', 'warm-mode-adapt');
                  if (theme === 'dark') el.classList.add('dark');
                  else if (theme === 'warm') el.classList.add('warm', 'warm-mode-adapt');
                  else if (theme === 'light') el.classList.add('light-mode-adapt');
                  else el.classList.add('dark', theme); // ocean/forest/lavender/rose/gold = dark + theme accent
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }

                // === Fullscreen (v2.7.2 style — aggressive, works on launch) ===
                // Request fullscreen immediately (browsers may block without gesture,
                // but we also retry on first interaction + visibilitychange + touchend).
                // The "press Esc" banner is a minor annoyance but FULLSCREEN WORKS.
                function requestFsNow() {
                  try {
                    var el = document.documentElement;
                    var p = el.requestFullscreen ? el.requestFullscreen() : null;
                    if (p && p.catch) p.catch(function(){});
                  } catch(e) {}
                }
                // Try immediately (may fail without gesture, that's OK)
                requestFsNow();
                // Retry on first interaction
                function onFirstGesture() {
                  requestFsNow();
                  document.removeEventListener('pointerdown', onFirstGesture);
                  document.removeEventListener('touchstart', onFirstGesture);
                }
                document.addEventListener('pointerdown', onFirstGesture, { passive: true });
                document.addEventListener('touchstart', onFirstGesture, { passive: true });
                // Re-enter on visibilitychange (returning from notification panel)
                document.addEventListener('visibilitychange', function() {
                  if (!document.hidden) requestFsNow();
                });
                // Hide address bar on load
                window.addEventListener('load', function() {
                  setTimeout(function() { window.scrollTo(0, 1); }, 0);
                  setTimeout(function() { window.scrollTo(0, 1); }, 100);
                });
                document.addEventListener('DOMContentLoaded', function() {
                  setTimeout(function() { window.scrollTo(0, 1); }, 0);
                });
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground overscroll-none">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
