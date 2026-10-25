'use client';
import dynamic from 'next/dynamic';
import '../../admin/admin.css';
const AdminPanel = dynamic(() => import('../../admin/AdminPanel'), {
  ssr: false,
  loading: () => <p className="empty-state">Menyiapkan ruang panitia…</p>,
});
export default function AdminClient() {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a href="/">← Kembali ke permainan</a>
        <span>Xylograph / Ruang panitia</span>
      </header>
      <AdminPanel />
    </div>
  );
}
