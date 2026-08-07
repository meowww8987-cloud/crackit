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

                // === Fullscreen on first user gesture ===
                // Browsers require a user gesture for requestFullscreen().
                // We call it ONCE on the first tap — the browser shows a
                // brief "press Esc" banner that auto-dismisses after ~3s.
                // After that, the app stays in fullscreen (no status bar).
                // In PWA mode (installed), display:fullscreen handles it
                // without any banner.
                var fsDone = false;
                function doFs() {
                  if (fsDone) return;
                  fsDone = true;
                  try {
                    var el = document.documentElement;
                    var p = el.requestFullscreen ? el.requestFullscreen() : null;
                    if (p && p.catch) p.catch(function(){});
                  } catch(e) {}
                  document.removeEventListener('pointerdown', doFs);
                  document.removeEventListener('touchstart', doFs);
                }
                // Only attach if NOT already in PWA fullscreen mode
                if (!window.matchMedia('(display-mode: fullscreen)').matches
                    && !window.matchMedia('(display-mode: standalone)').matches
                    && !(navigator.standalone)) {
                  document.addEventListener('pointerdown', doFs, { passive: true });
                  document.addEventListener('touchstart', doFs, { passive: true });
                }

                // Hide address bar on load (no gesture needed)
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
