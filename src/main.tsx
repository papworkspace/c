import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  // ล้าง Cache เวอร์ชันเก่าทั้งหมดทันทีและรีโหลดหากหน้าเว็บยังถูกควบคุมด้วย Service Worker ตัวเก่า
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((key) => {
          if (key !== 'thairoute-pwa-v9') {
            caches.delete(key).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }

  if ('serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_FORCE_RELOAD' && !reloading) {
        reloading = true;
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch(() => {});
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
