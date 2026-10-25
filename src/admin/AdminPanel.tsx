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
  X,
  ExternalLink,
  Copy,
  Check,
  Users,
  Calendar,
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
    return <span className="adm-badge adm-badge-success">Ingin hadir</span>;
  }
  if (val === 'maybe') {
    return <span className="adm-badge adm-badge-warning">Menyesuaikan</span>;
  }
  if (val === 'no') {
    return <span className="adm-badge adm-badge-danger">Tidak hadir</span>;
  }
  return <span className="adm-badge adm-badge-neutral">Belum ada</span>;
}

function committeeBadge(v: unknown) {
  const val = String(v || '');
  if (val === 'active') return <span className="adm-badge adm-badge-blue">Panitia aktif</span>;
  if (val === 'occasional') return <span className="adm-badge adm-badge-cyan">Bantu sesekali</span>;
  if (val === 'participant') return <span className="adm-badge adm-badge-neutral">Peserta saja</span>;
  if (val === 'unavailable') return <span className="adm-badge adm-badge-muted">Belum bisa</span>;
  return <span className="adm-badge adm-badge-neutral">{formatValue(v)}</span>;
}

export default function AdminPanel() {
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
      const data = await api<Row[]>('/admin');
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

  // Sync selectedRow when rows update
  useEffect(() => {
    if (selectedRow && rows) {
      const updated = rows.find((r) => r.id === selectedRow.id);
      if (updated) setSelectedRow(updated);
    }
  }, [rows]);

  // Escape to close
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
    setTogglingId(row.id);
    setError('');
    const newStatus = !row.consent_public;
    try {
      await api(`/admin/alumni/${encodeURIComponent(row.id)}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: newStatus }),
      });
      setRows((prev) =>
        prev
          ? prev.map((r) => (r.id === row.id ? { ...r, consent_public: newStatus } : r))
          : null,
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
    if (!deleteTarget) return;
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
    <div className="adm-container">
      {!rows ? (
        <div className="adm-login-wrap">
          <form
            className="adm-login-box"
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
            <div className="adm-login-icon">
              <Shield size={28} />
            </div>
            <h2 className="adm-login-title">Akses Ruang Panitia</h2>
            <p className="adm-login-subtitle">
              Masukkan kode akses admin untuk melihat data responden dan mengatur kontrol in-game.
            </p>
            <div className="adm-form-field">
              <label htmlFor="admin-code-input">Kode Akses Admin</label>
              <input
                id="admin-code-input"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Masukkan kode admin…"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={128}
              />
            </div>
            {error && (
              <div className="adm-alert adm-alert-error" role="alert">
                <XCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            <button className="adm-btn adm-btn-primary adm-btn-full" disabled={busy}>
              {busy ? 'Memverifikasi…' : 'Buka Ruang Panitia'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Header Title Section */}
          <div className="adm-header-block">
            <div className="adm-title-group">
              <div className="adm-pill-badge">
                <span className="adm-pill-dot" />
                Panel Admin
              </div>
              <h1 className="adm-page-title">Manajemen Responden & In-Game</h1>
              <p className="adm-page-desc">
                Pantau jawaban survei, verifikasi data responden ganda, dan atur penampilan avatar
                alumni di dunia game secara instan.
              </p>
            </div>

            <div className="adm-header-actions">
              <button className="adm-btn adm-btn-secondary" onClick={exported}>
                <Download size={15} />
                Ekspor CSV
              </button>
              <button
                className="adm-btn adm-btn-secondary"
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
                <RefreshCw size={15} className={busy ? 'adm-spin' : ''} />
                Segarkan
              </button>
              <button
                className="adm-btn adm-btn-ghost"
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

          {feedback && (
            <div className="adm-alert adm-alert-success">
              <CheckCircle2 size={16} />
              <span>{feedback}</span>
            </div>
          )}

          {error && (
            <div className="adm-alert adm-alert-error" role="alert">
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="adm-stats-row">
            <div className="adm-stat-card">
              <div className="adm-stat-icon-wrap adm-stat-blue">
                <Users size={20} />
              </div>
              <div className="adm-stat-content">
                <span className="adm-stat-label">Total Responden</span>
                <span className="adm-stat-number">{rows.length}</span>
              </div>
            </div>

            <div className="adm-stat-card">
              <div className="adm-stat-icon-wrap adm-stat-green">
                <Eye size={20} />
              </div>
              <div className="adm-stat-content">
                <span className="adm-stat-label">Tampil di In-Game</span>
                <span className="adm-stat-number">{rows.filter((r) => r.consent_public).length}</span>
              </div>
            </div>

            <div className="adm-stat-card">
              <div className="adm-stat-icon-wrap adm-stat-indigo">
                <Calendar size={20} />
              </div>
              <div className="adm-stat-content">
                <span className="adm-stat-label">Rencana Hadir</span>
                <span className="adm-stat-number">
                  {rows.filter((r) => r.answers.attendance === 'yes').length}
                </span>
              </div>
            </div>

            <div
              className={`adm-stat-card ${duplicateCount > 0 ? 'adm-stat-highlight-warn' : ''}`}
              onClick={() => duplicateCount > 0 && setOnlyDuplicates((prev) => !prev)}
              style={{ cursor: duplicateCount > 0 ? 'pointer' : 'default' }}
            >
              <div
                className={`adm-stat-icon-wrap ${
                  duplicateCount > 0 ? 'adm-stat-amber' : 'adm-stat-neutral'
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div className="adm-stat-content">
                <span className="adm-stat-label">
                  {duplicateCount > 0 ? '⚠️ Terindikasi Duplikat' : 'Data Ganda'}
                </span>
                <span className="adm-stat-number">{duplicateCount}</span>
              </div>
              {duplicateCount > 0 && (
                <span className="adm-stat-badge-hint">
                  {onlyDuplicates ? 'Lihat semua' : 'Filter duplikat'}
                </span>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="adm-filter-bar">
            <div className="adm-search-wrap">
              <Search size={16} />
              <input
                aria-label="Cari nama, panggilan, atau WhatsApp"
                placeholder="Cari nama, panggilan, atau nomor WhatsApp…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="adm-clear-btn"
                  onClick={() => setSearch('')}
                  aria-label="Hapus pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="adm-select-group">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                aria-label="Filter sumber"
              >
                <option value="all">Semua Sumber</option>
                <option value="legacy">Survei Lama (Excel)</option>
                <option value="game">Pendaftaran Game</option>
              </select>

              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value)}
                aria-label="Filter status game"
              >
                <option value="all">Semua Status Game</option>
                <option value="visible">Hanya yang Tampil di Game</option>
                <option value="hidden">Hanya yang Disembunyikan</option>
              </select>

              <button
                type="button"
                className={`adm-pill-filter ${onlyDuplicates ? 'active' : ''}`}
                onClick={() => setOnlyDuplicates((prev) => !prev)}
                title="Tampilkan hanya responden yang nomor atau namanya ganda"
              >
                <AlertTriangle size={14} />
                Hanya Duplikat ({duplicateCount})
              </button>
            </div>

            <div className="adm-filter-count">{filtered.length} responden ditampilkan</div>
          </div>

          {/* Clean White Modern Table */}
          <div className="adm-card-table-wrap">
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Alumni</th>
                    <th>Kontak WhatsApp</th>
                    <th>Sumber & Status</th>
                    <th>Kehadiran</th>
                    <th>Kepanitiaan</th>
                    <th>Status In-Game</th>
                    <th className="adm-th-actions">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const isDup = duplicateMap.has(row.id);
                    return (
                      <tr key={row.id} className={isDup ? 'adm-row-dup' : ''}>
                        <td>
                          <div className="adm-alumni-cell">
                            <div className="adm-avatar-circle">
                              {row.avatar ? (
                                <AvatarPortrait config={row.avatar} />
                              ) : (
                                <div className="adm-avatar-initial">
                                  {row.nickname?.[0] || row.full_name?.[0] || 'A'}
                                </div>
                              )}
                            </div>
                            <div className="adm-alumni-meta">
                              <span className="adm-name">{row.full_name}</span>
                              <div className="adm-name-sub">
                                <span className="adm-nick">{row.nickname}</span>
                                {isDup && (
                                  <span className="adm-badge adm-badge-warning adm-badge-xs">
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
                              className="adm-wa-link"
                              title="Buka chat WhatsApp"
                            >
                              <span>{row.whatsapp}</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="adm-muted-text">Tidak tersedia</span>
                          )}
                        </td>
                        <td>
                          <div className="adm-source-meta">
                            <span
                              className={`adm-source-pill ${
                                row.sourceType === 'legacy' ? 'source-legacy' : 'source-game'
                              }`}
                            >
                              {row.sourceType === 'legacy' ? (
                                <>
                                  <FileSpreadsheet size={12} /> Survei Lama
                                </>
                              ) : (
                                <>
                                  <Gamepad2 size={12} /> Game
                                </>
                              )}
                            </span>
                            <span className="adm-status-sub">
                              {row.completed_at ? '✓ Selesai' : '✎ Draf'}
                            </span>
                          </div>
                        </td>
                        <td>{attendanceBadge(row.answers.attendance)}</td>
                        <td>{committeeBadge(row.answers.committee)}</td>
                        <td>
                          <button
                            type="button"
                            className={`adm-vis-pill ${
                              row.consent_public ? 'vis-on' : 'vis-off'
                            }`}
                            disabled={togglingId === row.id}
                            onClick={() => toggleVisibility(row)}
                            title={
                              row.consent_public
                                ? 'Klik untuk menyembunyikan avatar dari game'
                                : 'Klik untuk menampilkan avatar di game'
                            }
                          >
                            {togglingId === row.id ? (
                              <RefreshCw size={12} className="adm-spin" />
                            ) : row.consent_public ? (
                              <Eye size={12} />
                            ) : (
                              <EyeOff size={12} />
                            )}
                            <span>{row.consent_public ? 'Tampil' : 'Sembunyi'}</span>
                          </button>
                        </td>
                        <td className="adm-td-actions">
                          <button
                            type="button"
                            className="adm-btn adm-btn-secondary adm-btn-sm"
                            onClick={() => {
                              setSelectedRow(row);
                              setDetailTab('mapped');
                            }}
                          >
                            <Eye size={13} />
                            Detail
                          </button>
                          <button
                            type="button"
                            className="adm-btn adm-btn-danger-icon"
                            onClick={() => setDeleteTarget(row)}
                            title="Hapus responden"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!filtered.length && (
                <div className="adm-empty-box">
                  <p>Tidak ada responden yang sesuai pencarian atau filter.</p>
                  {(search || source !== 'all' || visibilityFilter !== 'all' || onlyDuplicates) && (
                    <button
                      className="adm-btn adm-btn-secondary adm-btn-sm"
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

          {/* SLIDE-OVER DETAIL DRAWER */}
          {selectedRow && (
            <div className="adm-drawer-backdrop" onClick={() => setSelectedRow(null)}>
              <aside className="adm-drawer" onClick={(e) => e.stopPropagation()}>
                {/* Drawer Header */}
                <div className="adm-drawer-head">
                  <div className="adm-drawer-profile">
                    <div className="adm-drawer-avatar">
                      {selectedRow.avatar ? (
                        <AvatarPortrait config={selectedRow.avatar} />
                      ) : (
                        <div className="adm-avatar-initial large">
                          {selectedRow.nickname?.[0] || selectedRow.full_name?.[0] || 'A'}
                        </div>
                      )}
                    </div>
                    <div className="adm-drawer-name-block">
                      <h2 className="adm-drawer-name">{selectedRow.full_name}</h2>
                      <div className="adm-drawer-badges">
                        <span className="adm-badge adm-badge-blue">{selectedRow.nickname}</span>
                        <span
                          className={`adm-source-pill ${
                            selectedRow.sourceType === 'legacy' ? 'source-legacy' : 'source-game'
                          }`}
                        >
                          {selectedRow.sourceType === 'legacy'
                            ? 'Survei Lama'
                            : 'Pendaftaran Game'}
                        </span>
                        <span className="adm-badge adm-badge-neutral">
                          {selectedRow.completed_at ? 'Sudah Selesai' : 'Draf'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="adm-drawer-close"
                    onClick={() => setSelectedRow(null)}
                    aria-label="Tutup detail"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* IN-GAME VISIBILITY BANNER */}
                <div
                  className={`adm-vis-banner ${
                    selectedRow.consent_public ? 'banner-on' : 'banner-off'
                  }`}
                >
                  <div className="adm-vis-banner-info">
                    <div className="adm-vis-banner-icon">
                      {selectedRow.consent_public ? <Eye size={20} /> : <EyeOff size={20} />}
                    </div>
                    <div className="adm-vis-banner-text">
                      <strong>
                        Status In-Game: {selectedRow.consent_public ? 'Tampil' : 'Disembunyikan'}
                      </strong>
                      <p>
                        {selectedRow.consent_public
                          ? 'Avatar alumni ini aktif dan terlihat oleh pemain lain di Reunion Commons.'
                          : 'Avatar saat ini disembunyikan dan tidak akan muncul di dunia game.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`adm-btn ${
                      selectedRow.consent_public ? 'adm-btn-danger-outline' : 'adm-btn-primary'
                    }`}
                    disabled={togglingId === selectedRow.id}
                    onClick={() => toggleVisibility(selectedRow)}
                  >
                    {togglingId === selectedRow.id
                      ? 'Memproses…'
                      : selectedRow.consent_public
                        ? 'Sembunyikan dari Game'
                        : 'Tampilkan di Game'}
                  </button>
                </div>

                {/* DUPLICATE ALERT IN DRAWER */}
                {duplicateMap.has(selectedRow.id) && (
                  <div className="adm-dup-box">
                    <AlertTriangle size={18} />
                    <div className="adm-dup-box-content">
                      <strong>⚠️ Terdeteksi Akun Ganda (Duplikat)</strong>
                      <p>Memiliki nomor WhatsApp atau nama yang sama dengan akun lain:</p>
                      <ul className="adm-dup-list">
                        {duplicateMap.get(selectedRow.id)!.map((otherId) => {
                          const other = rows.find((r) => r.id === otherId);
                          return other ? (
                            <li key={otherId}>
                              <b>{other.full_name}</b> ({other.nickname}) —{' '}
                              <span>{other.sourceType === 'legacy' ? 'Survei Lama' : 'Game'}</span>
                              <button
                                type="button"
                                className="adm-link-btn"
                                onClick={() => setSelectedRow(other)}
                              >
                                Lihat Akun &rarr;
                              </button>
                            </li>
                          ) : null;
                        })}
                      </ul>
                      <p className="adm-dup-tip">
                        Anda dapat menghapus salah satu akun duplikat ini dengan tombol &ldquo;Hapus
                        Responden&rdquo; di bawah.
                      </p>
                    </div>
                  </div>
                )}

                {/* CONTACT BAR */}
                <div className="adm-contact-strip">
                  <div className="adm-contact-meta">
                    <span className="adm-contact-label">WhatsApp</span>
                    <span className="adm-contact-val">
                      {selectedRow.whatsapp || 'Tidak tersedia'}
                    </span>
                  </div>
                  {selectedRow.whatsapp && (
                    <div className="adm-contact-btns">
                      <button
                        type="button"
                        className="adm-btn adm-btn-secondary adm-btn-xs"
                        onClick={() => copyText(selectedRow.whatsapp!)}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? 'Tersalin' : 'Salin'}
                      </button>
                      <a
                        href={`https://wa.me/${selectedRow.whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        className="adm-btn adm-btn-primary adm-btn-xs"
                      >
                        <ExternalLink size={13} />
                        Chat WA
                      </a>
                    </div>
                  )}
                </div>

                {/* DRAWER TABS */}
                <nav className="adm-tabs-nav">
                  <button
                    type="button"
                    className={`adm-tab-link ${detailTab === 'mapped' ? 'active' : ''}`}
                    onClick={() => setDetailTab('mapped')}
                  >
                    Jawaban Game
                  </button>
                  {selectedRow.raw && (
                    <button
                      type="button"
                      className={`adm-tab-link ${detailTab === 'raw' ? 'active' : ''}`}
                      onClick={() => setDetailTab('raw')}
                    >
                      Jawaban Asli Formulir ({Object.keys(selectedRow.raw).length})
                    </button>
                  )}
                  <button
                    type="button"
                    className={`adm-tab-link ${detailTab === 'meta' ? 'active' : ''}`}
                    onClick={() => setDetailTab('meta')}
                  >
                    Info & Catatan
                  </button>
                </nav>

                {/* DRAWER CONTENT */}
                <div className="adm-drawer-body">
                  {detailTab === 'mapped' && (
                    <div className="adm-pane-mapped">
                      <div className="adm-cards-2col">
                        <section className="adm-info-card">
                          <h3>Kehadiran & Konsep</h3>
                          <dl className="adm-dl">
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

                        <section className="adm-info-card">
                          <h3>Kepanitiaan & Produksi</h3>
                          <dl className="adm-dl">
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

                        <section className="adm-info-card">
                          <h3>Tempat Pertemuan</h3>
                          <dl className="adm-dl">
                            <div>
                              <dt>Preferensi Lokasi</dt>
                              <dd>{formatValue(selectedRow.answers.venue)}</dd>
                            </div>
                            {selectedRow.answers.venueNote && (
                              <div>
                                <dt>Catatan / Usulan Tempat</dt>
                                <dd className="adm-note-box">
                                  {String(selectedRow.answers.venueNote)}
                                </dd>
                              </div>
                            )}
                          </dl>
                        </section>

                        <section className="adm-info-card">
                          <h3>Dukungan & Iuran</h3>
                          <dl className="adm-dl">
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
                        <section className="adm-info-card adm-message-block">
                          <h3>Pesan Kenangan untuk Teman-teman</h3>
                          <blockquote className="adm-quote">
                            &ldquo;{String(selectedRow.answers.message)}&rdquo;
                          </blockquote>
                        </section>
                      )}
                    </div>
                  )}

                  {detailTab === 'raw' && selectedRow.raw && (
                    <div className="adm-pane-raw">
                      <div className="adm-source-banner">
                        <FileSpreadsheet size={15} />
                        <span>
                          Sumber Dokumen: <b>{selectedRow.sourceName || 'Formulir Survei'}</b> &middot;
                          Baris Excel <b>{selectedRow.sourceRow || '—'}</b>
                        </span>
                      </div>
                      <div className="adm-raw-list">
                        {Object.entries(selectedRow.raw).map(([question, answer], idx) => (
                          <div key={question} className="adm-raw-card">
                            <span className="adm-raw-num">Q{idx + 1}</span>
                            <div className="adm-raw-content">
                              <span className="adm-raw-q">{question}</span>
                              <div
                                className={`adm-raw-a ${!answer?.trim() ? 'empty' : ''}`}
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
                    <div className="adm-pane-meta">
                      <dl className="adm-meta-dl">
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
                          <dt>Waktu Submit / Dibuat</dt>
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
                        <div className="adm-notes-wrap">
                          <h4>Catatan Pemetaan Data</h4>
                          <ul className="adm-notes-list">
                            {selectedRow.mappingNotes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="adm-drawer-foot">
                  <button
                    type="button"
                    className="adm-btn adm-btn-danger-outline"
                    onClick={() => setDeleteTarget(selectedRow)}
                  >
                    <Trash2 size={15} />
                    Hapus Responden
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn-secondary"
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
            <div className="adm-modal-backdrop" onClick={() => setDeleteTarget(null)}>
              <div className="adm-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="adm-modal-head">
                  <div className="adm-modal-icon-danger">
                    <Trash2 size={22} />
                  </div>
                  <h3>Hapus Responden?</h3>
                </div>
                <div className="adm-modal-body">
                  <p>
                    Apakah Anda yakin ingin menghapus data responden{' '}
                    <b>{deleteTarget.full_name}</b> ({deleteTarget.nickname})?
                  </p>
                  <p className="adm-modal-hint">
                    Tindakan ini akan menghapus data jawaban, profil, dan avatarnya dari database.
                    Jika responden ini duplikat, hanya akun ini yang akan dihapus.
                  </p>
                </div>
                <div className="adm-modal-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn-secondary"
                    disabled={deletingId === deleteTarget.id}
                    onClick={() => setDeleteTarget(null)}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="adm-btn adm-btn-danger"
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
