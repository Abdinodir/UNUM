import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Ilovani o'rnatish" tugmasi uchun.
 *
 * Chrome/Edge `beforeinstallprompt` hodisasini beradi — uni ushlab turamiz va
 * foydalanuvchi tugmani bosganda ko'rsatamiz. iOS Safari bu hodisani bermaydi,
 * shuning uchun u yerda qo'lda ko'rsatma matni chiqariladi.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Allaqachon standalone rejimda ochilgan bo'lsa — o'rnatilgan
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  /** iOS'da `beforeinstallprompt` yo'q — "Share → Add to Home Screen" ko'rsatiladi */
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === 'accepted';
  };

  return {
    /** Tugmani ko'rsatish kerakmi */
    canInstall: !installed && (Boolean(deferred) || isIos),
    needsManualSteps: !installed && !deferred && isIos,
    installed,
    install,
  };
}
