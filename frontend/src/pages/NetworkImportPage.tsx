import React, { useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface ImportStats {
  totalRows: number;
  matched: number;
  statusChanged: number;
  skipped: number;
  unmatched: number;
}

interface PreviewRow {
  msisdn: string;
  dealerCode: string;
  oldStatus: string;
  newStatus: string;
  lastSeenAt: string;
}

interface NetworkStatus {
  total: number;
  seenWithin7days: number;
  seenWithin30days: number;
  neverSeen: number;
  lastImportDate: string | null;
}

function StatusPill({ status }: { status: string }) {
  const online = status === 'active';
  const pending = status.startsWith('pending');
  const closed = status.startsWith('closed');
  const cls = online   ? 'bg-green-100 text-green-800'
            : pending  ? 'bg-amber-100 text-amber-800'
            : closed   ? 'bg-gray-200 text-gray-700'
            : 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : pending ? 'bg-amber-500' : 'bg-gray-400'}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function NetworkImportPage() {
  const [dragging, setDragging]       = useState(false);
  const [file, setFile]               = useState<File | null>(null);
  const [importing, setImporting]     = useState(false);
  const [stats, setStats]             = useState<ImportStats | null>(null);
  const [preview, setPreview]         = useState<PreviewRow[]>([]);
  const [netStatus, setNetStatus]     = useState<NetworkStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(() => {
    setStatusLoading(true);
    api.get('/network/status')
      .then(r => setNetStatus(r.data))
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setFile(f);
    else toast.error('Please drop a .csv file');
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setStats(null); setPreview([]);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/network/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStats(res.data.stats);
      setPreview(res.data.preview || []);
      toast.success(`✅ Import complete — ${res.data.stats.matched} devices updated`);
      loadStatus();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString() : '—';
  const daysAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📡 Network Activity Import</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a Zamtel network activity export (CSV) to update device online/offline status based on real MSISDN activity.
          Auditor-managed fields (holder name, GPS mapping, follow-ups) are never touched.
        </p>
      </div>

      {/* Network status widget */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statusLoading ? (
          [0,1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)
        ) : netStatus ? (
          <>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-green-700">{netStatus.seenWithin7days}</p>
              <p className="text-xs text-green-600 font-semibold mt-1">🟢 Online<br/><span className="font-normal text-gray-500">seen ≤ 7 days</span></p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-amber-700">{netStatus.seenWithin30days}</p>
              <p className="text-xs text-amber-600 font-semibold mt-1">🟡 Dormant<br/><span className="font-normal text-gray-500">8–30 days ago</span></p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-gray-600">{netStatus.neverSeen + (netStatus.total - netStatus.seenWithin7days - netStatus.seenWithin30days - netStatus.neverSeen)}</p>
              <p className="text-xs text-gray-500 font-semibold mt-1">⚫ Offline<br/><span className="font-normal">&gt; 30 days / no data</span></p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-blue-700">{netStatus.total}</p>
              <p className="text-xs text-blue-600 font-semibold mt-1">📱 Total devices</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Last import:<br/>{netStatus.lastImportDate ? fmt(netStatus.lastImportDate) : 'Never'}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* CSV format guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="font-semibold text-blue-800 text-sm mb-2">📋 Expected CSV Format</p>
        <p className="text-xs text-blue-700 mb-2">
          The CSV must have at least two columns — one for MSISDN and one for the last activity date.
          Column names are detected automatically. Supported names:
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-semibold text-blue-800 mb-1">MSISDN column (any of):</p>
            <code className="text-blue-700">msisdn, mobile, phone, number, a_number, subscriber</code>
          </div>
          <div>
            <p className="font-semibold text-blue-800 mb-1">Date column (any of):</p>
            <code className="text-blue-700">last_active, last_seen, last_call, last_data, activity_date, last_used</code>
          </div>
        </div>
        <div className="mt-3 bg-white rounded-lg p-3 font-mono text-xs text-gray-700 border border-blue-200">
          <p className="text-gray-400 mb-1"># Example CSV:</p>
          <p>msisdn,last_active</p>
          <p>260954566341,2026-05-05</p>
          <p>260977123456,05/05/2026</p>
          <p>0978654321,2026-04-10 14:32:00</p>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          ℹ️ Numbers starting with <code>0</code> are auto-converted to <code>260XXXXXXXXX</code>.
          Status rules: seen ≤ 7 days → <strong>active</strong>; more than 7 days → <strong>inactive</strong>.
          Devices with <em>pending_*</em> or <em>closed_*</em> status are never changed.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-zamtel-green bg-green-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-zamtel-green hover:bg-gray-50'
        }`}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
        {file ? (
          <div>
            <p className="text-3xl mb-2">📄</p>
            <p className="font-semibold text-gray-800">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
          </div>
        ) : (
          <div>
            <p className="text-4xl mb-3">📂</p>
            <p className="font-semibold text-gray-700">Drop your Zamtel network export CSV here</p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          </div>
        )}
      </div>

      {file && (
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex-1 py-3.5 bg-zamtel-green text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-green-700 transition-colors shadow-md"
          >
            {importing ? '⌛ Processing…' : '🚀 Run Import'}
          </button>
          <button
            onClick={() => { setFile(null); setStats(null); setPreview([]); }}
            className="px-5 py-3.5 border border-gray-300 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results */}
      {stats && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total rows',      value: stats.totalRows,     color: 'text-gray-800', bg: 'bg-gray-50   border-gray-200' },
              { label: 'Matched',         value: stats.matched,       color: 'text-green-700', bg: 'bg-green-50  border-green-200' },
              { label: 'Status changed',  value: stats.statusChanged, color: 'text-blue-700',  bg: 'bg-blue-50   border-blue-200' },
              { label: 'Unmatched MSISDN',value: stats.unmatched,     color: 'text-amber-700', bg: 'bg-amber-50  border-amber-200' },
              { label: 'Skipped (blank)', value: stats.skipped,       color: 'text-gray-500',  bg: 'bg-gray-50   border-gray-200' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border p-3 text-center ${bg}`}>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Status change breakdown from preview */}
          {preview.some(r => r.oldStatus !== r.newStatus) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="font-semibold text-blue-800 text-sm mb-2">Status changes in this import:</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {(() => {
                  const toActive   = preview.filter(r => r.oldStatus !== 'active'   && r.newStatus === 'active').length;
                  const toInactive = preview.filter(r => r.oldStatus === 'active'   && r.newStatus !== 'active').length;
                  return (
                    <>
                      {toActive   > 0 && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">🟢 → Online: {toActive}</span>}
                      {toInactive > 0 && <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-semibold">⚫ → Offline: {toInactive}</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Preview — first {preview.length} matched devices:
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['MSISDN', 'Dealer Code', 'Previous Status', 'New Status', 'Network Last Seen'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className={`border-b border-gray-100 ${r.oldStatus !== r.newStatus ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2 font-mono text-gray-600">{r.msisdn}</td>
                        <td className="px-3 py-2 font-semibold text-gray-800">{r.dealerCode}</td>
                        <td className="px-3 py-2"><StatusPill status={r.oldStatus} /></td>
                        <td className="px-3 py-2">
                          <StatusPill status={r.newStatus} />
                          {r.oldStatus !== r.newStatus && <span className="ml-1 text-blue-600 font-bold">↑</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{daysAgo(r.lastSeenAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
