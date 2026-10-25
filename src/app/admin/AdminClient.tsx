'use client';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Shield } from 'lucide-react';
import '../../admin/admin.css';

const AdminPanel = dynamic(() => import('../../admin/AdminPanel'), {
  ssr: false,
  loading: () => (
    <div className="adm-loading-screen">
      <div className="adm-spinner" />
      <p>Menyiapkan ruang panitia…</p>
    </div>
  ),
});

export default function AdminClient() {
  useEffect(() => {
    const origBodyBg = document.body.style.backgroundColor;
    const origHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#f8fafc';
    document.documentElement.style.backgroundColor = '#f8fafc';
    document.body.classList.add('adm-body-override');
    return () => {
      document.body.style.backgroundColor = origBodyBg;
      document.documentElement.style.backgroundColor = origHtmlBg;
      document.body.classList.remove('adm-body-override');
    };
  }, []);

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <div className="adm-topbar-inner">
          <div className="adm-brand">
            <div className="adm-brand-icon">
              <Shield size={16} />
            </div>
            <span className="adm-brand-name">XYLOGRAPH</span>
            <span className="adm-brand-divider">/</span>
            <span className="adm-brand-sub">Ruang Panitia</span>
          </div>
          <a href="/" className="adm-back-link">
            <ArrowLeft size={14} />
            <span>Kembali ke Permainan</span>
          </a>
        </div>
      </header>
      <div className="adm-content-container">
        <AdminPanel />
      </div>
    </div>
  );
}
