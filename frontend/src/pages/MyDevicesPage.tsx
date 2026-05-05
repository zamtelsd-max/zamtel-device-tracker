import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { Device } from '../types';
import StatusBadge from '../components/StatusBadge';
import FollowUpModal from '../components/FollowUpModal';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { getQueue, syncQueue, removeFromQueue } from '../utils/gpsQueue';

export default function MyDevicesPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [queueCount, setQueueCount] = useState(0);

  const fetchDevices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get('/devices', {
        params: { auditor: user.id, limit: 200 },
      });
      setDevices(res.data.data);
    } catch {
      toast.error('Failed to load your devices');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDevices();
    setQueueCount(getQueue().length);

    // Sync offline queue when online
    const handleOnline = async () => {
      const synced = await syncQueue(async (item) => {
        await api.post(`/devices/${item.deviceId}/followup`, {
          notes: item.notes,
          reportedStatus: item.reportedStatus,
          latitude: item.latitude,
          longitude: item.longitude,
          locationName: item.locationName,
        });
      });
      if (synced > 0) {
        toast.success(`Synced ${synced} offline follow-up(s)!`);
        setQueueCount(getQueue().length);
        fetchDevices();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchDevices]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Devices</h1>
        <div className="flex items-center gap-3">
          {queueCount > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full">
              📡 {queueCount} offline item(s) queued
            </span>
          )}
          <span className="text-sm text-gray-500">{devices.length} device(s)</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-zamtel-green" /></div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-gray-900">No devices assigned</h3>
          <p className="text-gray-500 text-sm mt-2">Go to <a href="#/devices-pool" className="text-zamtel-green underline">Devices Pool</a> to claim devices</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-mono font-bold text-zamtel-green text-base">{d.dealerCode}</div>
                  <div className="text-sm text-gray-700 mt-0.5">{d.agentName || '—'}</div>
                </div>
                <StatusBadge status={d.status} />
              </div>

              <div className="space-y-1.5 text-xs text-gray-500">
                {d.msisdn && <div><span className="font-medium">MSISDN:</span> {d.msisdn}</div>}
                {d.province && <div><span className="font-medium">Province:</span> {d.province}</div>}
                {d.aseBdcTse && <div><span className="font-medium">ASE/BDC/TSE:</span> {d.aseBdcTse}</div>}
                {d.phoneModel && <div><span className="font-medium">Phone:</span> {d.phoneModel}</div>}
                {d.imei1 && <div><span className="font-medium">IMEI1:</span> {d.imei1}</div>}
              </div>

              {/* Follow-ups */}
              {d.followUps && d.followUps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-600 mb-1">Last Follow-Up</div>
                  <div className="text-xs text-gray-500">
                    {new Date(d.followUps[0].visitedAt).toLocaleDateString()} — {d.followUps[0].reportedStatus?.replace(/_/g, ' ')}
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedDevice(d)}
                className="mt-4 w-full py-2 bg-zamtel-green text-white text-sm font-medium rounded-lg hover:bg-zamtel-green-dark transition-colors"
              >
                📝 Log Follow-Up
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedDevice && (
        <FollowUpModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onSuccess={fetchDevices}
        />
      )}
    </div>
  );
}
