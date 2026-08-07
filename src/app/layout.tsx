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
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    shortcut: ["/logo.svg"],
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

                // === Early fullscreen setup (runs before React loads) ===
                // NOTE: requestFullscreen() has been REMOVED — it triggers a
                // browser-native "To exit full screen, press Esc" banner that
                // appears every time fullscreen is entered/re-entered, which
                // ruins the UX. The app still looks fullscreen via CSS
                // (viewport-fit: cover + overscroll-none).
                // We only keep the address-bar-hiding scrollTo trick (no banner).
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
