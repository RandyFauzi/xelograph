'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  ArrowRight,
  Download,
  RefreshCw,
  Search,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  ExternalLink,
  Copy,
  Check,
  Filter,
  Users,
  Calendar,
  MapPin,
  Heart,
  Sparkles,
  MessageSquare,
  FileSpreadsheet,
  Gamepad2,
} from 'lucide-react';
import { api, download } from '../api';
import { LABELS, type AvatarConfig } from '../types';
import AvatarPortrait from '../AvatarPortrait';

export type Row = {
  id: string;
  full_name: string;
  nickname: string;
  whatsapp: string | null;
  completed_at: string | null;
  sourceType: 'game' | 'legacy';
  sourceName?: string;
  sourceRow?: number;
  consent_public?: boolean;
  avatar?: AvatarConfig | null;
  answers: Record<string, string | string[]>;
  raw?: Record<string, string>;
  mappingNotes?: string[];
  created_at?: string;
};

const fields: Record<string, string> = {
  concept: 'Konsep game',
  attendance: 'Kehadiran',
  committee: 'Kepanitiaan',
  department: 'Bidang panitia',
  activities: 'Kegiatan game',
  production: 'Tim produksi',
  venue: 'Tempat',
  venueNote: 'Usulan tempat',
  contribution: 'Iuran',
  sponsor: 'Dukungan',
  message: 'Pesan kenangan',
};

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(formatValue).join(', ') || 'Belum ada';
  return typeof v === 'string' ? LABELS[v] || v : 'Belum ada';
}

function attendanceBadge(v: unknown) {
  const val = String(v || '');
  if (val === 'yes') {
    return <span className="badge badge-success">Ingin hadir</span>;
  }
  if (val === 'maybe') {
    return <span className="badge badge-warning">Menyesuaikan</span>;
  }
  if (val === 'no') {
    return <span className="badge badge-danger">Tidak hadir</span>;
  }
  return <span className="badge badge-neutral">Belum ada</span>;
}

function committeeBadge(v: unknown) {
  const val = String(v || '');
  if (val === 'active') return <span className="badge badge-primary">Panitia aktif</span>;
  if (val === 'occasional') return <span className="badge badge-info">Bantu sesekali</span>;
  if (val === 'participant') return <span className="badge badge-neutral">Peserta saja</span>;
  if (val === 'unavailable') return <span className="badge badge-muted">Belum bisa</span>;
  return <span className="badge badge-neutral">{formatValue(v)}</span>;
}

export default function AdminPanel() {
  const [canManage, setCanManage] = useState(false);
  const [code, setCode] = useState(''),
    [rows, setRows] = useState<Row[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState(''),
    [search, setSearch] = useState(''),
    [source, setSource] = useState('all'),
    [visibilityFilter, setVisibilityFilter] = useState('all'),
    [onlyDuplicates, setOnlyDuplicates] = useState(false),
    [selectedRow, setSelectedRow] = useState<Row | null>(null),
    [detailTab, setDetailTab] = useState<'mapped' | 'raw' | 'meta'>('mapped'),
    [deleteTarget, setDeleteTarget] = useState<Row | null>(null),
    [togglingId, setTogglingId] = useState<string | null>(null),
    [deletingId, setDeletingId] = useState<string | null>(null),
    [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const [data, session] = await Promise.all([
        api<Row[]>('/admin'),
        api<{ role: 'owner' | 'viewer' }>('/admin/session'),
      ]);
      setCanManage(session.role === 'owner');
      setRows(data);
      setError('');
    } catch (e) {
      setRows(null);
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Update selectedRow reference if rows change
  useEffect(() => {
    if (selectedRow && rows) {
      const updated = rows.find((r) => r.id === selectedRow.id);
      if (updated) setSelectedRow(updated);
    }
  }, [rows]);

  // Keyboard navigation: Escape closes drawer & modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null);
        else if (selectedRow) setSelectedRow(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, selectedRow]);

  // Duplicate detection map
  const duplicateMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!rows) return map;
    const phoneMap = new Map<string, string[]>();
    const nameMap = new Map<string, string[]>();

    for (const r of rows) {
      if (r.whatsapp && r.whatsapp.length >= 8) {
        const clean = r.whatsapp.replace(/\D/g, '');
        const list = phoneMap.get(clean) || [];
        list.push(r.id);
        phoneMap.set(clean, list);
      }
      const cleanName = r.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
      if (cleanName.length >= 3) {
        const list = nameMap.get(cleanName) || [];
        list.push(r.id);
        nameMap.set(cleanName, list);
      }
    }

    for (const r of rows) {
      const dups = new Set<string>();
      if (r.whatsapp) {
        const clean = r.whatsapp.replace(/\D/g, '');
        const matches = phoneMap.get(clean) || [];
        for (const m of matches) if (m !== r.id) dups.add(m);
      }
      const cleanName = r.full_name.trim().toLowerCase().replace(/\s+/g, ' ');
      const nameMatches = nameMap.get(cleanName) || [];
      for (const m of nameMatches) if (m !== r.id) dups.add(m);

      if (dups.size > 0) {
        map.set(r.id, Array.from(dups));
      }
    }
    return map;
  }, [rows]);

  const duplicateCount = useMemo(() => duplicateMap.size, [duplicateMap]);

  const filtered = useMemo(() => {
    return (
      rows?.filter((row) => {
        if (source !== 'all' && row.sourceType !== source) return false;
        if (visibilityFilter === 'visible' && !row.consent_public) return false;
        if (visibilityFilter === 'hidden' && row.consent_public) return false;
        if (onlyDuplicates && !duplicateMap.has(row.id)) return false;
        if (search) {
          const q = search.toLowerCase();
          const match = [row.full_name, row.nickname, row.whatsapp || ''].some((val) =>
            val.toLowerCase().includes(q),
          );
          if (!match) return false;
        }
        return true;
      }) || []
    );
  }, [rows, search, source, visibilityFilter, onlyDuplicates, duplicateMap]);

  // Toggle in-game visibility
  const toggleVisibility = async (row: Row) => {
    if (!canManage) return;
    setTogglingId(row.id);
    setError('');
    const newStatus = !row.consent_public;
    try {
      await api(`/admin/alumni/${encodeURIComponent(row.id)}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: newStatus }),
      });
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === row.id ? { ...r, consent_public: newStatus } : r)) : null,
      );
      setFeedback(
        `Avatar ${row.nickname || row.full_name} berhasil ${newStatus ? 'diaktifkan (tampil di game)' : 'dinonaktifkan (disembunyikan)'}.`,
      );
      setTimeout(() => setFeedback(''), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  // Delete respondent
  const confirmDelete = async () => {
    if (!canManage || !deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setError('');
    try {
      await api(`/admin/alumni/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
      });
      setRows((prev) => (prev ? prev.filter((r) => r.id !== deleteTarget.id) : null));
      if (selectedRow?.id === deleteTarget.id) setSelectedRow(null);
      setFeedback(`Data responden ${deleteTarget.full_name} berhasil dihapus permanen.`);
      setTimeout(() => setFeedback(''), 4000);
      setDeleteTarget(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exported = () => {
    if (!canManage) return;
    const columns = [
      'Nama',
      'Panggilan',
      'WhatsApp',
      'Sumber',
      'Status Pengisian',
      'Tampil di Game',
      'Persetujuan bukber/reuni lama',
      ...Object.values(fields),
      'Jawaban asli',
      'Catatan pemetaan',
    ];
    const quote = (v: unknown) => {
      let s = String(v ?? '');
      if (/^\s*[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const content = [
      columns,
      ...filtered.map((row) => [
        row.full_name,
        row.nickname,
        row.whatsapp || '',
        row.sourceType === 'legacy' ? 'Survei lama' : 'Game',
        row.completed_at ? 'Selesai' : 'Draf',
        row.consent_public ? 'Ya' : 'Tidak',
        Object.entries(row.raw || {}).find(([k]) => k.toLowerCase().includes('setuju jika'))?.[1] ||
          '',
        ...Object.keys(fields).map((k) =>
          Array.isArray(row.answers[k])
            ? (row.answers[k] as string[]).map(formatValue).join('; ')
            : row.answers[k] || '',
        ),
        JSON.stringify(row.raw || {}),
        (row.mappingNotes || []).join('; '),
      ]),
    ];
    download(
      'xylograph-responden.csv',
      '\uFEFF' + content.map((r) => r.map(quote).join(',')).join('\r\n'),
      'text/csv;charset=utf-8',
    );
  };

  return (
    <div className="respondent-page">
      <header className="page-header">
        <div className="eyebrow">
          <span>XYLOGRAPH</span>
          <span className="divider">/</span>
          <span>RUANG PANITIA</span>
        </div>
        <h1>Manajemen Responden & Dunia Game</h1>
        <p>
          Pantau hasil survei, verifikasi responden ganda, dan atur penampilan avatar di in-game
          world secara langsung.
        </p>
      </header>

      {!rows ? (
        <div className="login-wrapper">
          <form
            className="admin-login-card"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api('/admin/session', { method: 'POST', body: JSON.stringify({ code }) });
                setCode('');
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="login-icon-box">
              <Shield size={32} />
            </div>
            <h2>Akses Ruang Panitia</h2>
            <p>Masukkan kode akses admin untuk membuka data responden dan kontrol in-game.</p>
            <label className="field">
              <span>Kode Akses Admin</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="XYLO-XXXX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={128}
              />
            </label>
            {error && (
              <div className="alert alert-error" role="alert">
                <XCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? 'Memverifikasi…' : 'Buka Dashboard'}
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      ) : (
        <>
          {feedback && (
            <div className="alert alert-success toast-feedback">
              <CheckCircle2 size={18} />
              <span>{feedback}</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error" role="alert">
              <XCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <p className="helper" role="status">
            {canManage
              ? 'Admin pribadi · Akses penuh'
              : 'Panitia · Hanya lihat, tanpa mengubah atau menghapus data'}
          </p>
          <div className="admin-toolbar">
            <div className="toolbar-left">
              {canManage && (
                <button className="btn btn-primary" onClick={exported}>
                  <Download size={16} />
                  Ekspor CSV
                </button>
              )}
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw size={16} className={busy ? 'spin' : ''} />
                Segarkan
              </button>
            </div>
            <div className="toolbar-right">
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  try {
                    await api('/admin/session', { method: 'DELETE' });
                    setRows(null);
                    setCode('');
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Lock size={15} />
                Keluar
              </button>
            </div>
          </div>

          <div className="admin-stats-grid">
            <article className="stat-card">
              <div className="stat-icon stat-blue">
                <Users size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Responden</span>
                <b className="stat-value">{rows.length}</b>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon stat-green">
                <Eye size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Tampil di In-Game</span>
                <b className="stat-value">{rows.filter((r) => r.consent_public).length}</b>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon stat-purple">
                <Calendar size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Ingin Hadir</span>
                <b className="stat-value">
                  {rows.filter((r) => r.answers.attendance === 'yes').length}
                </b>
              </div>
            </article>

            <article
              className={`stat-card ${duplicateCount > 0 ? 'stat-warning-card' : ''}`}
              onClick={() => duplicateCount > 0 && setOnlyDuplicates((prev) => !prev)}
              style={{ cursor: duplicateCount > 0 ? 'pointer' : 'default' }}
            >
              <div className={`stat-icon ${duplicateCount > 0 ? 'stat-amber' : 'stat-neutral'}`}>
                <AlertTriangle size={22} />
              </div>
              <div className="stat-info">
                <span className="stat-label">
                  {duplicateCount > 0 ? '⚠️ Terindikasi Duplikat' : 'Data Ganda'}
                </span>
                <b className="stat-value">{duplicateCount}</b>
              </div>
              {duplicateCount > 0 && (
                <span className="stat-action-hint">
                  {onlyDuplicates ? 'Lihat semua' : 'Filter duplikat'}
                </span>
              )}
            </article>
          </div>

          <div className="respondent-filter-bar">
            <div className="search-box">
              <Search size={18} />
              <input
                aria-label="Cari nama, panggilan, atau WhatsApp"
                placeholder="Cari nama, panggilan, atau WhatsApp…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch('')}
                  aria-label="Hapus pencarian"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="filter-selects">
              <div className="select-wrapper">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Filter sumber"
                >
                  <option value="all">Semua Sumber</option>
                  <option value="legacy">Survei Lama (Excel)</option>
                  <option value="game">Pendaftaran Game</option>
                </select>
              </div>

              <div className="select-wrapper">
                <select
                  value={visibilityFilter}
                  onChange={(e) => setVisibilityFilter(e.target.value)}
                  aria-label="Filter status game"
                >
                  <option value="all">Semua Status Game</option>
                  <option value="visible">Tampil di Game</option>
                  <option value="hidden">Disembunyikan</option>
                </select>
              </div>

              <button
                type="button"
                className={`btn btn-toggle-filter ${onlyDuplicates ? 'active' : ''}`}
                onClick={() => setOnlyDuplicates((prev) => !prev)}
                title="Tampilkan hanya akun yang nomor HP atau namanya ganda"
              >
                <AlertTriangle size={15} />
                Hanya Duplikat ({duplicateCount})
              </button>
            </div>

            <div className="filter-summary">
              <span>{filtered.length} responden</span>
            </div>
          </div>

          <div className="table-card">
            <div className="table-responsive">
              <table className="respondent-table">
                <thead>
                  <tr>
                    <th>Alumni</th>
                    <th>Kontak WhatsApp</th>
                    <th>Sumber & Status</th>
                    <th>Kehadiran</th>
                    <th>Kepanitiaan</th>
                    <th>Status In-Game</th>
                    <th className="th-actions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const isDup = duplicateMap.has(row.id);
                    return (
                      <tr key={row.id} className={isDup ? 'row-duplicate' : ''}>
                        <td>
                          <div className="alumni-cell">
                            <div className="avatar-mini">
                              {row.avatar ? (
                                <AvatarPortrait config={row.avatar} />
                              ) : (
                                <div className="avatar-placeholder">
                                  {row.nickname?.[0] || row.full_name?.[0] || 'A'}
                                </div>
                              )}
                            </div>
                            <div className="alumni-info">
                              <span className="alumni-fullname">{row.full_name}</span>
                              <div className="alumni-sub">
                                <span className="alumni-nickname">{row.nickname}</span>
                                {isDup && (
                                  <span
                                    className="badge badge-warning badge-sm"
                                    title="Nama atau nomor WhatsApp sama dengan akun lain"
                                  >
                                    Duplikat
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {row.whatsapp ? (
                            <a
                              href={`https://wa.me/${row.whatsapp}`}
                              target="_blank"
                              rel="noreferrer"
                              className="whatsapp-link"
                              title="Buka chat WhatsApp"
                            >
                              <span>{row.whatsapp}</span>
                              <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span className="text-muted">Tidak tersedia</span>
                          )}
                        </td>
                        <td>
                          <div className="source-cell">
                            <span
                              className={`source-badge ${
                                row.sourceType === 'legacy' ? 'source-legacy' : 'source-game'
                              }`}
                            >
                              {row.sourceType === 'legacy' ? (
                                <>
                                  <FileSpreadsheet size={13} /> Survei Lama
                                </>
                              ) : (
                                <>
                                  <Gamepad2 size={13} /> Game
                                </>
                              )}
                            </span>
                            <span className="progress-status">
                              {row.completed_at ? '✓ Selesai' : '✎ Draf'}
                            </span>
                          </div>
                        </td>
                        <td>{attendanceBadge(row.answers.attendance)}</td>
                        <td>{committeeBadge(row.answers.committee)}</td>
                        <td>
                          <button
                            type="button"
                            className={`visibility-pill ${
                              row.consent_public ? 'vis-active' : 'vis-inactive'
                            }`}
                            disabled={!canManage || togglingId === row.id}
                            onClick={() => toggleVisibility(row)}
                            title={
                              row.consent_public
                                ? 'Klik untuk sembunyikan avatar dari game'
                                : 'Klik untuk tampilkan avatar di game'
                            }
                          >
                            {togglingId === row.id ? (
                              <RefreshCw size={13} className="spin" />
                            ) : row.consent_public ? (
                              <Eye size={13} />
                            ) : (
                              <EyeOff size={13} />
                            )}
                            <span>{row.consent_public ? 'Tampil' : 'Sembunyi'}</span>
                          </button>
                        </td>
                        <td className="td-actions">
                          <button
                            type="button"
                            className="btn-action btn-detail"
                            onClick={() => {
                              setSelectedRow(row);
                              setDetailTab('mapped');
                            }}
                            title="Buka detail responden"
                          >
                            <Eye size={15} />
                            Detail
                          </button>
                          {canManage && (
                            <button
                              type="button"

                              className="btn-action btn-delete"
                              onClick={() => setDeleteTarget(row)}
                              title="Hapus responden"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!filtered.length && (
                <div className="empty-state-box">
                  <p>Tidak ada responden yang sesuai kriteria pencarian atau filter.</p>
                  {(search || source !== 'all' || visibilityFilter !== 'all' || onlyDuplicates) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSearch('');
                        setSource('all');
                        setVisibilityFilter('all');
                        setOnlyDuplicates(false);
                      }}
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* DETAIL SLIDE-OVER DRAWER */}
          {selectedRow && (
            <div className="drawer-overlay" onClick={() => setSelectedRow(null)}>
              <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                  <div className="drawer-profile">
                    <div className="drawer-avatar">
                      {selectedRow.avatar ? (
                        <AvatarPortrait config={selectedRow.avatar} />
                      ) : (
                        <div className="avatar-placeholder large">
                          {selectedRow.nickname?.[0] || selectedRow.full_name?.[0] || 'A'}
                        </div>
                      )}
                    </div>
                    <div className="drawer-profile-info">
                      <h2>{selectedRow.full_name}</h2>
                      <div className="drawer-tags">
                        <span className="badge badge-primary">{selectedRow.nickname}</span>
                        <span
                          className={`source-badge ${
                            selectedRow.sourceType === 'legacy' ? 'source-legacy' : 'source-game'
                          }`}
                        >
                          {selectedRow.sourceType === 'legacy' ? 'Survei Lama' : 'Pendaftaran Game'}
                        </span>
                        <span className="badge badge-neutral">
                          {selectedRow.completed_at ? 'Sudah Selesai' : 'Draf'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="drawer-close"
                    onClick={() => setSelectedRow(null)}
                    aria-label="Tutup detail"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* IN-GAME VISIBILITY BANNER */}
                <div
                  className={`visibility-banner ${
                    selectedRow.consent_public ? 'is-active' : 'is-inactive'
                  }`}
                >
                  <div className="vis-banner-content">
                    <div className="vis-banner-icon">
                      {selectedRow.consent_public ? <Eye size={22} /> : <EyeOff size={22} />}
                    </div>
                    <div className="vis-banner-text">
                      <strong>
                        Status In-Game: {selectedRow.consent_public ? 'Tampil' : 'Disembunyikan'}
                      </strong>
                      <p>
                        {selectedRow.consent_public
                          ? 'Avatar alumni ini saat ini aktif dan dapat dilihat oleh pemain lain di Reunion Commons.'
                          : 'Avatar saat ini disembunyikan dan tidak akan muncul di dunia game.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn ${
                      selectedRow.consent_public ? 'btn-vis-disable' : 'btn-vis-enable'
                    }`}
                    disabled={!canManage || togglingId === selectedRow.id}
                    onClick={() => toggleVisibility(selectedRow)}
                  >
                    {togglingId === selectedRow.id
                      ? 'Memproses…'
                      : selectedRow.consent_public
                        ? 'Sembunyikan dari Game'
                        : 'Tampilkan di Game'}
                  </button>
                </div>

                {/* DUPLICATE WARNING IN DRAWER */}
                {duplicateMap.has(selectedRow.id) && (
                  <div className="drawer-dup-banner">
                    <AlertTriangle size={20} />
                    <div className="drawer-dup-text">
                      <strong>⚠️ Terdeteksi Akun Ganda</strong>
                      <p>Responden ini memiliki nomor WhatsApp atau nama yang sama dengan:</p>
                      <ul className="dup-list">
                        {duplicateMap.get(selectedRow.id)!.map((otherId) => {
                          const other = rows.find((r) => r.id === otherId);
                          return other ? (
                            <li key={otherId}>
                              <b>{other.full_name}</b> ({other.nickname}) —{' '}
                              <span>{other.sourceType === 'legacy' ? 'Survei Lama' : 'Game'}</span>
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => setSelectedRow(other)}
                              >
                                Lihat Akun &rarr;
                              </button>
                            </li>
                          ) : null;
                        })}
                      </ul>
                      <p className="dup-advice">
                        Anda dapat menghapus salah satu akun ganda dengan tombol &ldquo;Hapus
                        Responden&rdquo; di bawah.
                      </p>
                    </div>
                  </div>
                )}

                {/* CONTACT QUICK BAR */}
                <div className="drawer-contact-bar">
                  <div className="contact-item">
                    <span className="contact-label">WhatsApp</span>
                    <span className="contact-value">
                      {selectedRow.whatsapp || 'Tidak tersedia'}
                    </span>
                  </div>
                  {selectedRow.whatsapp && (
                    <div className="contact-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyText(selectedRow.whatsapp!)}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Tersalin' : 'Salin'}
                      </button>
                      <a
                        href={`https://wa.me/${selectedRow.whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                      >
                        <ExternalLink size={14} />
                        Chat WA
                      </a>
                    </div>
                  )}
                </div>

                {/* DRAWER TABS */}
                <nav className="drawer-tabs">
                  <button
                    type="button"
                    className={`tab-btn ${detailTab === 'mapped' ? 'active' : ''}`}
                    onClick={() => setDetailTab('mapped')}
                  >
                    Jawaban Game
                  </button>
                  {selectedRow.raw && (
                    <button
                      type="button"
                      className={`tab-btn ${detailTab === 'raw' ? 'active' : ''}`}
                      onClick={() => setDetailTab('raw')}
                    >
                      Jawaban Asli Formulir ({Object.keys(selectedRow.raw).length})
                    </button>
                  )}
                  <button
                    type="button"
                    className={`tab-btn ${detailTab === 'meta' ? 'active' : ''}`}
                    onClick={() => setDetailTab('meta')}
                  >
                    Info & Catatan
                  </button>
                </nav>

                <div className="drawer-body">
                  {detailTab === 'mapped' && (
                    <div className="tab-pane mapped-answers-pane">
                      <div className="cards-grid">
                        <section className="answer-card">
                          <h3>Kehadiran & Konsep</h3>
                          <dl className="qa-list">
                            <div>
                              <dt>Rencana Kehadiran</dt>
                              <dd>{attendanceBadge(selectedRow.answers.attendance)}</dd>
                            </div>
                            <div>
                              <dt>Konsep Acara</dt>
                              <dd>{formatValue(selectedRow.answers.concept)}</dd>
                            </div>
                          </dl>
                        </section>

                        <section className="answer-card">
                          <h3>Kepanitiaan & Produksi</h3>
                          <dl className="qa-list">
                            <div>
                              <dt>Status Panitia</dt>
                              <dd>{committeeBadge(selectedRow.answers.committee)}</dd>
                            </div>
                            <div>
                              <dt>Bidang yang Diminati</dt>
                              <dd>{formatValue(selectedRow.answers.department)}</dd>
                            </div>
                            <div>
                              <dt>Bantuan Tim Produksi</dt>
                              <dd>{formatValue(selectedRow.answers.production)}</dd>
                            </div>
                          </dl>
                        </section>

                        <section className="answer-card">
                          <h3>Tempat Pertemuan</h3>
                          <dl className="qa-list">
                            <div>
                              <dt>Preferensi Lokasi</dt>
                              <dd>{formatValue(selectedRow.answers.venue)}</dd>
                            </div>
                            {selectedRow.answers.venueNote && (
                              <div>
                                <dt>Catatan / Usulan Tempat</dt>
                                <dd className="note-text">
                                  {String(selectedRow.answers.venueNote)}
                                </dd>
                              </div>
                            )}
                          </dl>
                        </section>

                        <section className="answer-card">
                          <h3>Dukungan & Iuran</h3>
                          <dl className="qa-list">
                            <div>
                              <dt>Kesediaan Iuran</dt>
                              <dd>{formatValue(selectedRow.answers.contribution)}</dd>
                            </div>
                            <div>
                              <dt>Dukungan Sponsor / Donatur</dt>
                              <dd>{formatValue(selectedRow.answers.sponsor)}</dd>
                            </div>
                          </dl>
                        </section>
                      </div>

                      {selectedRow.answers.message && (
                        <section className="answer-card message-card">
                          <h3>Pesan Kenangan untuk Teman-teman</h3>
                          <blockquote className="message-quote">
                            &ldquo;{String(selectedRow.answers.message)}&rdquo;
                          </blockquote>
                        </section>
                      )}
                    </div>
                  )}

                  {detailTab === 'raw' && selectedRow.raw && (
                    <div className="tab-pane raw-answers-pane">
                      <div className="raw-source-banner">
                        <FileSpreadsheet size={16} />
                        <span>
                          Sumber: <b>{selectedRow.sourceName || 'Formulir Survei'}</b> &middot;
                          Baris Excel <b>{selectedRow.sourceRow || '—'}</b>
                        </span>
                      </div>
                      <div className="raw-qa-list">
                        {Object.entries(selectedRow.raw).map(([question, answer], idx) => (
                          <div key={question} className="raw-qa-item">
                            <span className="raw-qa-num">Q{idx + 1}</span>
                            <div className="raw-qa-content">
                              <span className="raw-question">{question}</span>
                              <div
                                className={`raw-answer ${!answer?.trim() ? 'empty-answer' : ''}`}
                              >
                                {answer?.trim() || 'Kosong di formulir sumber'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailTab === 'meta' && (
                    <div className="tab-pane meta-pane">
                      <dl className="meta-list">
                        <div>
                          <dt>ID Responden</dt>
                          <dd>
                            <code>{selectedRow.id}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Tipe Sumber</dt>
                          <dd>
                            {selectedRow.sourceType === 'legacy'
                              ? 'Impor Lembar Kerja Excel/Form'
                              : 'Pendaftaran Akun Game'}
                          </dd>
                        </div>
                        <div>
                          <dt>Waktu Pendaftaran / Submit</dt>
                          <dd>
                            {selectedRow.completed_at
                              ? new Date(selectedRow.completed_at).toLocaleString('id-ID')
                              : selectedRow.created_at
                                ? new Date(selectedRow.created_at).toLocaleString('id-ID')
                                : '—'}
                          </dd>
                        </div>
                        {selectedRow.sourceName && (
                          <div>
                            <dt>Dokumen Sumber</dt>
                            <dd>
                              {selectedRow.sourceName} (Baris {selectedRow.sourceRow})
                            </dd>
                          </div>
                        )}
                      </dl>

                      {!!selectedRow.mappingNotes?.length && (
                        <div className="mapping-notes-section">
                          <h4>Catatan Pemetaan Data</h4>
                          <ul className="mapping-notes-list">
                            {selectedRow.mappingNotes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="drawer-footer">
                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-danger-outline"

                      onClick={() => setDeleteTarget(selectedRow)}
                    >
                      <Trash2 size={16} />
                      Hapus Responden
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSelectedRow(null)}
                  >
                    Tutup
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* CONFIRM DELETE MODAL */}
          {deleteTarget && (
            <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-danger-icon">
                    <Trash2 size={24} />
                  </div>
                  <h3>Hapus Responden?</h3>
                </div>
                <div className="modal-body">
                  <p>
                    Apakah Anda yakin ingin menghapus responden <b>{deleteTarget.full_name}</b> (
                    {deleteTarget.nickname})?
                  </p>
                  <p className="modal-subtext">
                    Tindakan ini akan menghapus data jawaban, profil, dan avatarnya dari database.
                    Jika responden ini duplikat, hanya akun ini yang dihapus.
                  </p>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={deletingId === deleteTarget.id}
                    onClick={() => setDeleteTarget(null)}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={deletingId === deleteTarget.id}
                    onClick={confirmDelete}
                  >
                    {deletingId === deleteTarget.id ? 'Menghapus…' : 'Hapus Permanen'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
