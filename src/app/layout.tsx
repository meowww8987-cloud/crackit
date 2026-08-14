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
                  el.classList.remove('dark', 'warm', 'ocean', 'forest', 'rose', 'gold', 'light-mode-adapt', 'warm-mode-adapt', 'rose-mode-adapt');
                  if (theme === 'dark') el.classList.add('dark');
                  else if (theme === 'warm') el.classList.add('warm', 'warm-mode-adapt');
                  else if (theme === 'light') el.classList.add('light-mode-adapt');
                  else if (theme === 'rose') el.classList.add('rose', 'rose-mode-adapt'); // rose = soothing LIGHT theme, no .dark
                  else if (theme === 'ocean' || theme === 'forest' || theme === 'gold') el.classList.add('dark', theme);
                  else el.classList.add('dark'); // fallback for any legacy value (e.g. 'lavender')
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }

                // === Fullscreen via manifest ===
                // REMOVED: requestFullscreen() calls (v2.19.0) — was causing the
                // "To exit full screen, press Esc" toast on every launch + visibility
                // return + focus session start. Now relies on manifest display:fullscreen
                // which works on installed Android PWAs (no JS, no toast, status bar hidden).
                // Browser tabs + iOS Safari will show the address bar/status bar — acceptable
                // tradeoff for no toast.
                // Hide address bar on load (still works for non-installed contexts)
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
