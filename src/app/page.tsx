'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/app/AppShell';

export default function Home() {
  // Apply theme + text size on mount
  useEffect(() => {
    import('@/lib/store/settings').then(({ useSettings, applyTextSize, applyTheme }) => {
      const s = useSettings.getState();
      applyTextSize(s.textSize);
      applyTheme(s.appTheme);
    });
  }, []);

  return <AppShell />;
}
