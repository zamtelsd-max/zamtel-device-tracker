import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Device } from '../types';
import { addToQueue, isOnline } from '../utils/gpsQueue';

interface Props {
  device: Device;
  onClose: () => void;
  onSuccess: () => void;
}

type PrimaryStatus = 'visited_active' | 'inactive_confirmed' | '';
type SecondaryStatus = 'lost_stolen' | 'damaged' | 'not_found' | '';

export default function FollowUpModal({ device, onClose, onSuccess }: Props) {
  const [primaryStatus, setPrimaryStatus]   = useState<PrimaryStatus>('');
  const [secondaryStatus, setSecondaryStatus] = useState<SecondaryStatus>('');
  const [notes, setNotes]                   = useState('');
  const [latitude, setLatitude]             = useState<number | null>(null);
  const [longitude, setLongitude]           = useState<number | null>(null);
  const [locationName, setLocationName]     = useState('');
  const [gpsLoading, setGpsLoading]         = useState(false);
  const [submitting, setSubmitting]         = useState(false);

  // Derived: final reportedStatus sent to backend
  const reportedStatus = secondaryStatus || primaryStatus;

  const captureGPS = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationName(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGpsLoading(false);
        toast.success('📍 GPS captured');
      },
      err => { setGpsLoading(false); toast.error(`GPS error: ${err.message}`); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportedStatus) { toast.error('Please select a device status'); return; }

    setSubmitting(true);
    const payload = { notes, reportedStatus, latitude, longitude, locationName };

    if (!isOnline()) {
      addToQueue({
        id: `${device.id}-${Date.now()}`,
        deviceId: device.id,
        ...payload,
        timestamp: new Date().toISOString(),
      });
      toast('Saved offline — will sync when connected', { icon: '📡' });
      setSubmitting(false);
      onClose();
      return;
    }

    try {
      await api.post(`/devices/${device.id}/followup`, payload);
      toast.success(
        reportedStatus === 'visited_active'
          ? '✅ Device marked ACTIVE'
          : reportedStatus === 'inactive_confirmed'
          ? '⚫ Device marked INACTIVE'
          : '📋 Follow-up logged'
      );
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Log Field Visit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Device info */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <p className="text-sm font-mono font-bold text-zamtel-green">{device.dealerCode}</p>
          {device.agentName  && <p className="text-sm text-gray-700">{device.agentName}</p>}
          {device.phoneModel && <p className="text-xs text-gray-500">{device.phoneModel}</p>}
          {device.msisdn     && <p className="text-xs text-gray-400 font-mono">SIM: {device.msisdn}</p>}
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* ── Step 1: Primary status — big bold toggle ── */}
          <div>
            <p className="text-sm font-bold text-gray-800 mb-3">
              Step 1 — Is this device <span className="underline">currently active</span>? <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* ACTIVE */}
              <button
                type="button"
                onClick={() => { setPrimaryStatus('visited_active'); setSecondaryStatus(''); }}
                className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm transition-all ${
                  primaryStatus === 'visited_active'
                    ? 'border-green-500 bg-green-50 text-green-700 shadow-md scale-[1.02]'
                    : 'border-gray-200 text-gray-500 hover:border-green-300 hover:bg-green-50/50'
                }`}
              >
                <span className="text-3xl">🟢</span>
                <span>YES — Active</span>
                <span className="text-xs font-normal text-current opacity-70">Device is in use</span>
              </button>

              {/* INACTIVE */}
              <button
                type="button"
                onClick={() => setPrimaryStatus('inactive_confirmed')}
                className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm transition-all ${
                  primaryStatus === 'inactive_confirmed'
                    ? 'border-gray-500 bg-gray-100 text-gray-800 shadow-md scale-[1.02]'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <span className="text-3xl">⚫</span>
                <span>NO — Inactive</span>
                <span className="text-xs font-normal text-current opacity-70">Device not in use</span>
              </button>
            </div>
          </div>

          {/* ── Step 2: Secondary reason (only if inactive) ── */}
          {primaryStatus === 'inactive_confirmed' && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <p className="text-sm font-bold text-gray-700 mb-3">Step 2 — What is the reason?</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: '',              label: 'Holder inactive',  icon: '💤', desc: 'Device exists but unused' },
                  { val: 'not_found',     label: 'Not found',        icon: '❓', desc: 'Could not locate device' },
                  { val: 'lost_stolen',   label: 'Lost / Stolen',    icon: '🚨', desc: 'Requires police report' },
                  { val: 'damaged',       label: 'Damaged',          icon: '💥', desc: 'Physical damage' },
                ] as { val: SecondaryStatus; label: string; icon: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setSecondaryStatus(opt.val)}
                    className={`flex flex-col items-center text-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      secondaryStatus === opt.val
                        ? 'border-zamtel-pink bg-pink-50 text-zamtel-pink shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span>{opt.label}</span>
                    <span className="text-[10px] font-normal opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
              {(secondaryStatus === 'lost_stolen') && (
                <p className="mt-2 text-xs text-red-600 font-semibold">⚠️ This will flag the device for police report verification.</p>
              )}
              {(secondaryStatus === 'damaged') && (
                <p className="mt-2 text-xs text-amber-600 font-semibold">⚠️ This will flag the device for damage verification.</p>
              )}
            </div>
          )}

          {/* ── GPS ── */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">📍 GPS Location <span className="font-normal text-gray-400">(recommended)</span></p>
            <button
              type="button"
              onClick={captureGPS}
              disabled={gpsLoading}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                latitude
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-dashed border-gray-300 text-gray-500 hover:border-zamtel-green hover:text-zamtel-green'
              }`}
            >
              {gpsLoading ? '⌛ Getting location…'
                : latitude ? `✅ GPS: ${latitude.toFixed(5)}, ${longitude?.toFixed(5)}`
                : '📍 Tap to capture GPS'}
            </button>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green resize-none"
              placeholder="e.g. Device seen at Chilenje market, holder confirmed active use…"
            />
          </div>

          {/* ── Submit ── */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !primaryStatus}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
                primaryStatus === 'visited_active'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : primaryStatus === 'inactive_confirmed'
                  ? 'bg-gray-700 hover:bg-gray-800 text-white'
                  : 'bg-zamtel-green text-white'
              }`}
            >
              {submitting ? 'Saving…'
                : primaryStatus === 'visited_active' ? '✅ Mark Active & Save'
                : primaryStatus === 'inactive_confirmed' ? '⚫ Mark Inactive & Save'
                : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
