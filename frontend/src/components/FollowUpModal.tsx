import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Device } from '../types';
import { addToQueue, isOnline } from '../utils/gpsQueue';

interface Props {
  device: Device;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FollowUpModal({ device, onClose, onSuccess }: Props) {
  const [notes, setNotes] = useState('');
  const [reportedStatus, setReportedStatus] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const captureGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGpsLoading(false);
        toast.success('GPS captured!');
      },
      (err) => {
        setGpsLoading(false);
        toast.error(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportedStatus) { toast.error('Please select a status'); return; }

    setSubmitting(true);

    const payload = {
      notes,
      reportedStatus,
      latitude,
      longitude,
      locationName,
    };

    if (!isOnline()) {
      // Queue offline
      addToQueue({
        id: `${device.id}-${Date.now()}`,
        deviceId: device.id,
        ...payload,
        latitude: latitude,
        longitude: longitude,
        timestamp: new Date().toISOString(),
      });
      toast('Saved offline — will sync when connected', { icon: '📡' });
      setSubmitting(false);
      onClose();
      return;
    }

    try {
      await api.post(`/devices/${device.id}/followup`, payload);
      toast.success('Follow-up logged successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to log follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Log Follow-Up</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Device: </span>
            <span className="font-mono text-zamtel-green">{device.dealerCode}</span>
          </div>
          {device.agentName && (
            <div className="text-sm text-gray-600">{device.agentName}</div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* GPS */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GPS Location</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={captureGPS}
                disabled={gpsLoading}
                className="flex items-center gap-2 px-3 py-2 bg-zamtel-green text-white rounded-lg text-sm hover:bg-zamtel-green-dark disabled:opacity-50"
              >
                {gpsLoading ? '⏳' : '📍'} {gpsLoading ? 'Capturing...' : 'Capture GPS'}
              </button>
              {latitude && longitude && (
                <span className="text-xs text-gray-500 self-center">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              )}
            </div>
          </div>

          {/* Location name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location Name (optional)</label>
            <input
              type="text"
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
              placeholder="e.g. Chilenje Market"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reported Status *</label>
            <select
              value={reportedStatus}
              onChange={e => setReportedStatus(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
            >
              <option value="">Select status...</option>
              <option value="visited_active">Visited – Still Active</option>
              <option value="inactive_confirmed">Inactive – Confirmed</option>
              <option value="lost_stolen">Lost / Stolen</option>
              <option value="damaged">Damaged</option>
              <option value="not_found">Not Found</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
              placeholder="Additional observations..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-zamtel-green text-white rounded-lg text-sm font-medium hover:bg-zamtel-green-dark disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
