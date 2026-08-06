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
                  el.classList.remove('dark', 'warm', 'light-mode-adapt', 'warm-mode-adapt');
                  if (theme === 'dark') el.classList.add('dark');
                  else if (theme === 'warm') el.classList.add('warm', 'warm-mode-adapt');
                  else el.classList.add('light-mode-adapt');
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
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
