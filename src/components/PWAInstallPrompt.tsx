import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Share, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

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
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-3.5 py-2 text-xs font-black flex items-center justify-center gap-2 border-b border-amber-300">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>โหมดออฟไลน์ — กำลังแสดงข้อมูลล่าสุดที่โหลดเก็บไว้ในเว็บ</span>
    </div>
  );
};

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'card' }> = ({
  variant = 'header'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs sm:text-sm font-black">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>ติดตั้งเป็นแอปพลิเคชันเรียบร้อยแล้ว</span>
        </div>
      );
    }
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          variant === 'header'
            ? 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-2xs transition-colors cursor-pointer'
            : 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black shadow-sm transition-colors cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{isIOS ? 'ติดตั้งแอปบน iPhone/iPad' : 'ติดตั้งเป็นแอปบนเครื่อง'}</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border-2 border-slate-200 p-6 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    วิธีติดตั้งแอป “เช็คน้ำจราจร” ลงหน้าจอหลัก
                  </h3>
                  <p className="text-xs font-bold text-slate-600">
                    เปิดใช้งานได้เต็มจอเหมือนแอปทั่วไป รวดเร็ว ไม่ต้องพิมพ์เว็บใหม่
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm font-bold text-slate-700">
              <div className="rounded-2xl bg-sky-50 border border-sky-200 p-3.5 space-y-1.5">
                <p className="font-black text-sky-950 flex items-center gap-1.5">
                  <Share className="w-4 h-4 text-sky-700" />
                  <span>สำหรับ iPhone / iPad (Safari):</span>
                </p>
                <p>
                  1. กดปุ่ม <strong>แชร์ (Share)</strong> ที่แถบเมนูด้านล่างของเบราว์เซอร์
                </p>
                <p>
                  2. เลื่อนลงมาแล้วกด <strong>“เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)”</strong>
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-1.5">
                <p className="font-black text-emerald-950 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>สำหรับ Android (Chrome) และคอมพิวเตอร์:</span>
                </p>
                <p>
                  1. กดที่เมนู <strong>จุด 3 จุด (⋮)</strong> มุมขวาบนของ Chrome หรือไอคอนติดตั้งบนแถบ URL
                </p>
                <p>
                  2. เลือก <strong>“ติดตั้งแอป (Install app)”</strong> หรือ{' '}
                  <strong>“เพิ่มลงในหน้าจอหลัก”</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black cursor-pointer transition-colors"
            >
              เข้าใจแล้ว ปิดหน้าต่างนี้
            </button>
          </div>
        </div>
      )}
    </>
  );
};
