import React, { useEffect, useState } from 'react';
import KpiCard from '../components/KpiCard';
import DeviceMap from '../components/DeviceMap';
import api from '../utils/api';
import { DashboardStats, Device } from '../types';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allocation, setAllocation] = useState<any[]>([]);
  const [pending, setPending] = useState<Device[]>([]);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/allocation'),
      api.get('/dashboard/pending-closures'),
      api.get('/dashboard/auditor-summary'),
    ]).then(([s, a, p, au]) => {
      setStats(s.data);
      setAllocation(a.data);
      setPending(p.data);
      setAuditors(au.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zamtel-green" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">Last updated: {new Date().toLocaleString()}</span>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Total Devices" value={stats.total} icon="📱" color="blue" />
          <KpiCard label="Active" value={stats.active} icon="✅" color="green" />
          <KpiCard label="Inactive" value={stats.inactive} icon="⚠️" color="amber" />
          <KpiCard label="Pending Actions" value={stats.pendingActions} icon="⏳" color="purple" sub={`Police: ${stats.pending.police} | Damage: ${stats.pending.damage} | GA: ${stats.pending.ga}`} />
          <KpiCard label="Closed" value={stats.closed} icon="🔒" color="gray" />
        </div>
      )}

      {/* Map */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Device GPS Map</h2>
        <DeviceMap />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Province Breakdown */}
        {stats && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">By Province</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.byProvince.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{p.province}</span>
                  <span className="text-sm font-semibold text-zamtel-green">{p.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-xs text-gray-500">
              <span>DSA: {stats.byRole.dsa}</span>
              <span>Retailer: {stats.byRole.retailer}</span>
            </div>
          </div>
        )}

        {/* Pending Closures */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Pending Closures ({pending.length})</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {pending.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No pending closures 🎉</p>
            )}
            {pending.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-mono font-medium text-gray-900">{d.dealerCode}</div>
                  <div className="text-xs text-gray-500">{d.agentName}</div>
                  {d.allocatedAuditor && (
                    <div className="text-xs text-gray-400">Auditor: {d.allocatedAuditor.name}</div>
                  )}
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade Auditor Status Breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Trade Auditor Dashboard</h2>
        <p className="text-xs text-gray-500 mb-4">Devices assigned to each Trade Auditor — broken down by status</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 rounded-lg">
                <th className="text-left py-2.5 px-3 font-semibold text-gray-700 rounded-l-lg">Trade Auditor</th>
                <th className="text-right py-2.5 px-3 font-semibold text-gray-700">Assigned</th>
                <th className="text-right py-2.5 px-3 font-semibold text-green-700">Active</th>
                <th className="text-right py-2.5 px-3 font-semibold text-amber-700">Inactive</th>
                <th className="text-right py-2.5 px-3 font-semibold text-purple-700">Pending Police</th>
                <th className="text-right py-2.5 px-3 font-semibold text-orange-600">Pending Damage</th>
                <th className="text-right py-2.5 px-3 font-semibold text-teal-700">Pending GA</th>
                <th className="text-right py-2.5 px-3 font-semibold text-gray-500">Closed</th>
                <th className="text-right py-2.5 px-3 font-semibold text-blue-600 rounded-r-lg">Follow-Ups</th>
              </tr>
            </thead>
            <tbody>
              {auditors.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400 text-sm">No assignments yet</td></tr>
              )}
              {auditors.map((a, i) => (
                <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-gray-900">{a.name}</div>
                    <div className="text-xs text-gray-400">@{a.username}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-gray-800">{a.total}</td>
                  <td className="py-2.5 px-3 text-right">
                    {a.active > 0 ? <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full">{a.active}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {a.inactive > 0 ? <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">{a.inactive}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {a.pendingPolice > 0 ? <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5 rounded-full">{a.pendingPolice}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {a.pendingDamage > 0 ? <span className="inline-block bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-0.5 rounded-full">{a.pendingDamage}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {a.pendingGA > 0 ? <span className="inline-block bg-teal-100 text-teal-800 text-xs font-semibold px-2 py-0.5 rounded-full">{a.pendingGA}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {a.closed > 0 ? <span className="inline-block bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">{a.closed}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {a.followUps > 0 ? <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">{a.followUps}</span> : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {auditors.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="py-2.5 px-3 text-gray-700">Totals</td>
                  <td className="py-2.5 px-3 text-right">{auditors.reduce((s,a)=>s+a.total,0)}</td>
                  <td className="py-2.5 px-3 text-right text-green-700">{auditors.reduce((s,a)=>s+a.active,0)}</td>
                  <td className="py-2.5 px-3 text-right text-amber-700">{auditors.reduce((s,a)=>s+a.inactive,0)}</td>
                  <td className="py-2.5 px-3 text-right text-purple-700">{auditors.reduce((s,a)=>s+a.pendingPolice,0)}</td>
                  <td className="py-2.5 px-3 text-right text-orange-600">{auditors.reduce((s,a)=>s+a.pendingDamage,0)}</td>
                  <td className="py-2.5 px-3 text-right text-teal-700">{auditors.reduce((s,a)=>s+a.pendingGA,0)}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{auditors.reduce((s,a)=>s+a.closed,0)}</td>
                  <td className="py-2.5 px-3 text-right text-blue-600">{auditors.reduce((s,a)=>s+a.followUps,0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Allocation by ASE/BDC/TSE</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-gray-700">ASE/BDC/TSE</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-700">Total</th>
                <th className="text-right py-2 px-3 font-semibold text-green-700">Active</th>
                <th className="text-right py-2 px-3 font-semibold text-amber-700">Inactive</th>
                <th className="text-right py-2 px-3 font-semibold text-purple-700">Pending</th>
                <th className="text-right py-2 px-3 font-semibold text-gray-500">Closed</th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-800">{row.ase}</td>
                  <td className="py-2 px-3 text-right font-semibold">{row.total}</td>
                  <td className="py-2 px-3 text-right text-green-700">{row.active}</td>
                  <td className="py-2 px-3 text-right text-amber-700">{row.inactive}</td>
                  <td className="py-2 px-3 text-right text-purple-700">{row.pending}</td>
                  <td className="py-2 px-3 text-right text-gray-500">{row.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
