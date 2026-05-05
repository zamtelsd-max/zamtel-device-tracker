import React, { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Device } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    province: '',
    ase: '',
  });
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get('/devices', {
        params: {
          ...filters,
          limit: 200,
          page: 1,
        },
      });
      setDevices(res.data.data);
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/export/devices', {
        params: filters,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zamtel-devices-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded!');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const statusCounts = devices.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-zamtel-green text-white rounded-lg text-sm font-medium hover:bg-zamtel-green-dark disabled:opacity-50"
        >
          📥 {exporting ? 'Exporting...' : 'Export XLSX'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Filters</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select value={filters.status} onChange={e => setFilters(f => ({...f, status: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending_police_report">Pending Police</option>
              <option value="pending_damage_verification">Pending Damage</option>
              <option value="pending_ga_verification">Pending GA</option>
              <option value="closed_lost_stolen">Closed Lost/Stolen</option>
              <option value="closed_damaged">Closed Damaged</option>
              <option value="closed_inactive_resolved">Closed Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Province</label>
            <input type="text" placeholder="e.g. Lusaka" value={filters.province}
              onChange={e => setFilters(f => ({...f, province: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">ASE/BDC/TSE</label>
            <input type="text" placeholder="Search owner" value={filters.ase}
              onChange={e => setFilters(f => ({...f, ase: e.target.value}))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green" />
          </div>
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="mt-4 px-5 py-2 bg-zamtel-green text-white rounded-lg text-sm font-medium hover:bg-zamtel-green-dark disabled:opacity-50">
          🔍 {loading ? 'Loading...' : 'Run Report'}
        </button>
      </div>

      {/* Summary */}
      {searched && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Summary — {devices.length} devices</h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-600 capitalize">{status.replace(/_/g, ' ')}: </span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Table */}
      {searched && !loading && devices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Dealer Code','Agent','MSISDN','Province','ASE/BDC/TSE','Phone Model','IMEI 1','Status','Updated'].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devices.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 font-mono text-zamtel-green">{d.dealerCode}</td>
                    <td className="py-2 px-4">{d.agentName || '—'}</td>
                    <td className="py-2 px-4">{d.msisdn || '—'}</td>
                    <td className="py-2 px-4">{d.province || '—'}</td>
                    <td className="py-2 px-4">{d.aseBdcTse || '—'}</td>
                    <td className="py-2 px-4">{d.phoneModel || '—'}</td>
                    <td className="py-2 px-4 font-mono text-xs">{d.imei1 || '—'}</td>
                    <td className="py-2 px-4"><StatusBadge status={d.status} /></td>
                    <td className="py-2 px-4 text-gray-400 text-xs">{new Date(d.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
