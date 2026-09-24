import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installCount, setInstallCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('wnw_pwa_install_count')) || 0;
    } catch {
      return 0;
    }
  });

  const recordInstall = (method: string) => {
    try {
      const cur = Number(localStorage.getItem('wnw_pwa_install_count')) || 0;
      const next = cur + 1;
      const now = new Date().toISOString();
      localStorage.setItem('wnw_pwa_install_count', String(next));
      localStorage.setItem('wnw_pwa_last_installed_at', now);
      setInstallCount(next);

      // Send telemetry ping to backend API
      apiFetch('pwa-analytics/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          platform: window.navigator.platform,
          userAgent: window.navigator.userAgent,
          timestamp: now
        })
      }).catch(() => {});

      // Record persistently to Firestore for Admin Dashboard System Zone metrics
      const userAgent = window.navigator.userAgent || '';
      const platform = window.navigator.platform || '';
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent.toLowerCase());
      const isAndroidDevice = /android/.test(userAgent.toLowerCase());
      const deviceType = isIOSDevice ? 'ios' : isAndroidDevice ? 'android' : 'desktop';

      addDoc(collection(db, 'pwa_installs'), {
        method,
        platform,
        userAgent,
        deviceType,
        installedAt: now,
        timestamp: serverTimestamp()
      }).catch(() => {});

      setDoc(
        doc(db, 'pwa_metrics', 'summary'),
        {
          totalInstalls: increment(1),
          lastInstalledAt: now,
          [`${deviceType}Installs`]: increment(1),
          [`${method}Count`]: increment(1)
        },
        { merge: true }
      ).catch(() => {});
    } catch {}
  };

  useEffect(() => {
    // Detect standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Track standalone launch if not logged on device yet
    if (isStandalone) {
      try {
        if (!localStorage.getItem('wnw_pwa_standalone_logged')) {
          localStorage.setItem('wnw_pwa_standalone_logged', new Date().toISOString());
          recordInstall('standalone_launch');
        }
      } catch {}
    }

    // Backfill sync if this device was previously installed but not yet synced to Firestore
    try {
      const curCount = Number(localStorage.getItem('wnw_pwa_install_count')) || 0;
      if (curCount > 0 && !localStorage.getItem('wnw_pwa_firestore_synced')) {
        localStorage.setItem('wnw_pwa_firestore_synced', new Date().toISOString());
        recordInstall(isStandalone ? 'standalone_active' : 'previous_install_sync');
      }
    } catch {}

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      recordInstall('appinstalled_event');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      recordInstall('user_accepted_prompt');
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
    installCount,
  };
}
