import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { Device } from '../types';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';

export default function DevicesPoolPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [searchCode, setSearchCode] = useState('');
  const [searchAgent, setSearchAgent] = useState('');
  const [filterProvince, setFilterProvince] = useState('');
  const [filterTeamLead, setFilterTeamLead] = useState('');

  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50, status: 'inactive' };
      // client-side filtering is done via the data returned
      const res = await api.get('/devices', { params });
      setDevices(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleAssign = async (deviceId: string) => {
    setAssigning(deviceId);
    try {
      await api.post(`/devices/${deviceId}/assign`);
      toast.success('Device assigned to you!');
      fetchDevices();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Assignment failed';
      if (err.response?.status === 409) {
        toast.error('Device already assigned to another auditor');
      } else {
        toast.error(msg);
      }
    } finally {
      setAssigning(null);
    }
  };

  // Client-side filter
  const filtered = devices.filter(d => {
    if (searchCode && !d.dealerCode?.toLowerCase().includes(searchCode.toLowerCase())) return false;
    if (searchAgent && !d.agentName?.toLowerCase().includes(searchAgent.toLowerCase())) return false;
    if (filterProvince && d.province?.toLowerCase() !== filterProvince.toLowerCase()) return false;
    if (filterTeamLead && !d.teamLead?.toLowerCase().includes(filterTeamLead.toLowerCase())) return false;
    return true;
  });

  const provinces = [...new Set(devices.map(d => d.province).filter(Boolean))].sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Devices Pool</h1>
        <span className="text-sm text-gray-500">{total} inactive devices available</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search dealer code..."
          value={searchCode}
          onChange={e => setSearchCode(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
        />
        <input
          type="text"
          placeholder="Search agent name..."
          value={searchAgent}
          onChange={e => setSearchAgent(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
        />
        <select
          value={filterProvince}
          onChange={e => setFilterProvince(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
        >
          <option value="">All Provinces</option>
          {provinces.map(p => <option key={p} value={p!}>{p}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filter team lead..."
          value={filterTeamLead}
          onChange={e => setFilterTeamLead(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-zamtel-green" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Dealer Code</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Agent Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">MSISDN</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Province</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Team Lead</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">ASE/BDC/TSE</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-500">No unassigned devices found</td></tr>
                )}
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono font-medium text-zamtel-green">{d.dealerCode}</td>
                    <td className="py-3 px-4 text-gray-800">{d.agentName || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{d.msisdn || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{d.province || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{d.teamLead || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{d.aseBdcTse || '—'}</td>
                    <td className="py-3 px-4"><StatusBadge status={d.status} /></td>
                    <td className="py-3 px-4">
                      {!d.allocatedToAuditorId ? (
                        <button
                          onClick={() => handleAssign(d.id)}
                          disabled={assigning === d.id}
                          className="px-3 py-1.5 bg-zamtel-green text-white rounded-lg text-xs font-medium hover:bg-zamtel-green-dark disabled:opacity-50"
                        >
                          {assigning === d.id ? '...' : 'Assign to Me'}
                        </button>
                      ) : d.allocatedAuditor ? (
                        <span className="text-xs text-gray-500">→ {d.allocatedAuditor.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400">Assigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {filtered.length} of {devices.length} loaded</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1 border rounded text-xs disabled:opacity-40">← Prev</button>
              <span className="px-2 py-1">Page {page}</span>
              <button onClick={() => setPage(p => p+1)} disabled={devices.length < 50} className="px-3 py-1 border rounded text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
