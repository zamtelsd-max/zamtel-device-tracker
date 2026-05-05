import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { Device } from '../types';
import StatusBadge from '../components/StatusBadge';
import ClosureModal from '../components/ClosureModal';
import toast from 'react-hot-toast';

export default function ClosureQueuePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/pending-closures');
      setDevices(res.data);
    } catch {
      toast.error('Failed to load closure queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const loadDevice = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    try {
      const res = await api.get(`/devices/${id}`);
      setDevices(prev => prev.map(d => d.id === id ? { ...d, followUps: res.data.followUps } : d));
    } catch {}
  };

  const policeQueue = devices.filter(d => d.status === 'pending_police_report');
  const damageQueue = devices.filter(d => d.status === 'pending_damage_verification');
  const gaQueue = devices.filter(d => d.status === 'pending_ga_verification');

  const QueueSection = ({ title, items, color }: { title: string; items: Device[]; color: string }) => (
    <div className={`bg-white rounded-2xl border-2 ${color} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Queue empty ✓</p>
      ) : (
        <div className="space-y-3">
          {items.map(d => (
            <div key={d.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => loadDevice(d.id)}
              >
                <div>
                  <div className="font-mono font-semibold text-zamtel-green text-sm">{d.dealerCode}</div>
                  <div className="text-xs text-gray-600">{d.agentName}</div>
                  {d.allocatedAuditor && (
                    <div className="text-xs text-gray-400">Auditor: {d.allocatedAuditor.name}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedDevice(d); }}
                    className="px-3 py-1.5 bg-zamtel-pink text-white text-xs font-medium rounded-lg hover:bg-zamtel-pink-dark"
                  >
                    Close
                  </button>
                </div>
              </div>

              {expandedId === d.id && d.followUps && d.followUps.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-3 bg-gray-50">
                  <div className="text-xs font-medium text-gray-700 mb-2">Follow-Up History</div>
                  <div className="space-y-2">
                    {d.followUps.map(fu => (
                      <div key={fu.id} className="text-xs text-gray-600 bg-white rounded p-2 border border-gray-100">
                        <div className="flex justify-between">
                          <span className="font-medium">{fu.auditor?.name}</span>
                          <span className="text-gray-400">{new Date(fu.visitedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-0.5">{fu.reportedStatus?.replace(/_/g, ' ')} — {fu.notes || '(no notes)'}</div>
                        {fu.latitude && fu.longitude && (
                          <div className="text-gray-400">GPS: {fu.latitude.toFixed(4)}, {fu.longitude.toFixed(4)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Closure Queue</h1>
        <span className="text-sm text-gray-500">{devices.length} items pending</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-zamtel-green" /></div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          <QueueSection title="🚨 Police Report Needed" items={policeQueue} color="border-purple-200" />
          <QueueSection title="🔧 Damage Verification" items={damageQueue} color="border-orange-200" />
          <QueueSection title="📊 GA Verification" items={gaQueue} color="border-teal-200" />
        </div>
      )}

      {selectedDevice && (
        <ClosureModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onSuccess={fetchPending}
        />
      )}
    </div>
  );
}
