import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Device } from '../types';
import StatusBadge from '../components/StatusBadge';

// ─── Helper: fly map to new centre when lat/lng changes ──────────────────────
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 14, { duration: 1.2 }); }, [lat, lng]);
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface MappedDevice {
  id: string; dealerCode: string; agentName?: string; phoneModel?: string;
  province?: string; status: string; imei1?: string; imei2?: string; msisdn?: string;
  holderName?: string; holderNrc?: string; holderContact?: string;
  mapLatitude: number; mapLongitude: number; mappedAt?: string; updatedAt?: string;
  lastSeenAt?: string; lastSeenSource?: string;
  mappedBy?: { name: string };
}

const STATUS_COLOR: Record<string, string> = {
  active: '#00843D', inactive: '#6B7280',
  pending_police_report: '#DC2626', pending_damage_verification: '#D97706',
  pending_ga_verification: '#7C3AED',
  closed_lost_stolen: '#111827', closed_damaged: '#92400E', closed_inactive_resolved: '#374151',
};

// A device is "online" if its status is active
const isOnline = (d: MappedDevice) => d.status === 'active';

// Human-readable last-seen — prefer network data, fall back to updatedAt/mappedAt
function lastSeen(d: MappedDevice): { text: string; source: string } {
  if (d.lastSeenAt) {
    const diff = Date.now() - new Date(d.lastSeenAt).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    const text  = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : hours < 24 ? `${hours}h ago` : `${days}d ago`;
    return { text, source: '📡 Network data' };
  }
  const ts = d.updatedAt || d.mappedAt;
  if (!ts) return { text: 'Unknown', source: '' };
  const diff = Date.now() - new Date(ts).getTime();
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const text  = days > 0 ? `${days}d ago` : `${hours}h ago`;
  return { text, source: '🗂️ App activity' };
}

type FilterMode = 'all' | 'online' | 'offline';

export default function MapDevicePage() {
  // ── IMEI lookup state
  const [imeiInput, setImeiInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [lookupError, setLookupError] = useState('');

  // ── Form state
  const [holderName, setHolderName]       = useState('');
  const [holderNrc, setHolderNrc]         = useState('');
  const [holderContact, setHolderContact] = useState('');
  const [gpsLoading, setGpsLoading]       = useState(false);
  const [lat, setLat]                     = useState<number | null>(null);
  const [lng, setLng]                     = useState<number | null>(null);
  const [locName, setLocName]             = useState('');
  const [saving, setSaving]               = useState(false);

  // ── Mapped devices for the live map
  const [mapped, setMapped]     = useState<MappedDevice[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filter, setFilter]     = useState<FilterMode>('all');
  const imeiRef = useRef<HTMLInputElement>(null);

  const loadMapped = useCallback(() => {
    api.get('/devices/mapped').then(r => setMapped(r.data)).catch(() => {});
    setMapLoaded(true);
  }, []);

  useEffect(() => { loadMapped(); }, [loadMapped]);

  // ── IMEI lookup
  const handleLookup = async () => {
    const imei = imeiInput.trim();
    if (!imei) return;
    setLookupLoading(true);
    setLookupError('');
    setDevice(null);
    try {
      const res = await api.get(`/devices/lookup-imei?imei=${encodeURIComponent(imei)}`);
      const d: Device = res.data;
      setDevice(d);
      // Pre-fill if already mapped
      setHolderName(d.holderName  ?? '');
      setHolderNrc(d.holderNrc    ?? '');
      setHolderContact(d.holderContact ?? '');
      setLat(d.mapLatitude  ?? null);
      setLng(d.mapLongitude ?? null);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'No device found with that IMEI';
      setLookupError(msg);
    } finally {
      setLookupLoading(false);
    }
  };

  // ── GPS capture
  const captureGps = () => {
    if (!navigator.geolocation) { toast.error('GPS not supported on this device'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocName(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGpsLoading(false);
        toast.success('📍 GPS captured');
      },
      () => { toast.error('Could not get location. Enable GPS and try again.'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // ── Save mapping
  const handleSave = async () => {
    if (!device) return;
    if (!holderName.trim()) { toast.error('Holder name is required'); return; }
    if (!lat || !lng)       { toast.error('GPS location is required — tap Capture GPS'); return; }
    setSaving(true);
    try {
      await api.patch(`/devices/${device.id}/map`, {
        holderName: holderName.trim(),
        holderNrc:     holderNrc.trim()     || undefined,
        holderContact: holderContact.trim() || undefined,
        latitude:  lat,
        longitude: lng,
        locationName: locName || undefined,
      });
      toast.success(`✅ Device ${device.dealerCode} mapped successfully!`);
      // Reset form
      setDevice(null); setImeiInput('');
      setHolderName(''); setHolderNrc(''); setHolderContact('');
      setLat(null); setLng(null); setLocName('');
      loadMapped();
      imeiRef.current?.focus();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const zambiaCentre: [number, number] = [-13.5, 28.5];
  const onlineCount  = mapped.filter(isOnline).length;
  const offlineCount = mapped.filter(d => !isOnline(d)).length;
  const filteredMapped = filter === 'online'  ? mapped.filter(isOnline)
                       : filter === 'offline' ? mapped.filter(d => !isOnline(d))
                       : mapped;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">📍 Map Devices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scan or enter an IMEI to look up a device, record the holder's details, capture GPS, and pin it on the map.
          {mapped.length > 0 && (
          <span className="ml-2 inline-flex items-center gap-2">
            <span className="font-semibold text-zamtel-green">{mapped.length} mapped</span>
            <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              {onlineCount} online
            </span>
            <span className="inline-flex items-center gap-1 text-gray-500 font-semibold">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
              {offlineCount} offline
            </span>
          </span>
        )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: IMEI Entry + Form ── */}
        <div className="space-y-5">

          {/* IMEI lookup */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-xl">🔍</span> Step 1 — Enter or Scan IMEI
            </h2>
            <div className="flex gap-2">
              <input
                ref={imeiRef}
                type="text"
                inputMode="numeric"
                value={imeiInput}
                onChange={e => setImeiInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="Enter IMEI number…"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green font-mono"
                autoFocus
              />
              <button
                onClick={handleLookup}
                disabled={lookupLoading || !imeiInput.trim()}
                className="px-5 py-3 bg-zamtel-green text-white rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-green-700 transition-colors"
              >
                {lookupLoading ? '…' : 'Look up'}
              </button>
            </div>
            {lookupError && (
              <p className="mt-2 text-red-600 text-sm flex items-center gap-1">
                <span>⚠️</span> {lookupError}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400">
              Tip: most barcode scanners send an Enter keystroke automatically.
            </p>
          </div>

          {/* Device details card */}
          {device && (
            <div className="bg-zamtel-green/5 border border-zamtel-green/30 rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-xl">📱</span> Step 2 — Device Details
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {[
                  ['Dealer Code', device.dealerCode],
                  ['Agent Name',  device.agentName],
                  ['Phone Model', device.phoneModel],
                  ['IMEI 1',      device.imei1],
                  ['IMEI 2',      device.imei2],
                  ['MSISDN',      device.msisdn],
                  ['Province',    device.province],
                  ['Region',      device.region],
                  ['ASE/BDC/TSE', device.aseBdcTse],
                  ['Team Lead',   device.teamLead],
                  ['Type',        device.dsaOrRetailer],
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label as string}>
                    <span className="text-gray-500">{label}: </span>
                    <span className="font-medium text-gray-800">{val as string}</span>
                  </div>
                ))}
                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <span className="text-gray-500">Status:</span>
                  <StatusBadge status={device.status} />
                  {device.holderName && (
                    <span className="ml-auto text-xs text-zamtel-green font-semibold">✅ Previously mapped</span>
                  )}
                </div>
              </div>

              {/* Holder details */}
              <div className="border-t border-zamtel-green/20 pt-4 space-y-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-lg">👤</span> Step 3 — Holder Details
                </h3>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={holderName}
                    onChange={e => setHolderName(e.target.value)}
                    placeholder="Name of person holding device"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">NRC Number</label>
                  <input
                    type="text"
                    value={holderNrc}
                    onChange={e => setHolderNrc(e.target.value)}
                    placeholder="e.g. 123456/78/1"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Contact Number</label>
                  <input
                    type="tel"
                    value={holderContact}
                    onChange={e => setHolderContact(e.target.value)}
                    placeholder="e.g. 097XXXXXXX"
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                  />
                </div>
              </div>

              {/* GPS */}
              <div className="border-t border-zamtel-green/20 pt-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                  <span className="text-lg">📍</span> Step 4 — Capture GPS Location
                </h3>
                <button
                  onClick={captureGps}
                  disabled={gpsLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-zamtel-green text-zamtel-green hover:bg-zamtel-green hover:text-white transition-colors disabled:opacity-50"
                >
                  {gpsLoading ? '⌛ Getting location…' : lat ? '🔄 Re-capture GPS' : '📍 Capture My GPS Location'}
                </button>
                {lat && lng && (
                  <div className="mt-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                    <p className="text-xs font-semibold text-green-700">✅ GPS captured</p>
                    <p className="text-xs text-green-600 font-mono">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
                    {locName && <p className="text-xs text-gray-500 mt-0.5">{locName}</p>}
                  </div>
                )}
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving || !holderName.trim() || !lat || !lng}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-zamtel-green text-white disabled:opacity-50 hover:bg-green-700 transition-colors shadow-md"
              >
                {saving ? '💾 Saving…' : '✅ Save & Pin on Map'}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Live map of all mapped devices ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="text-xl">🗺️</span> Live Device Map
              </h2>
              <span className="text-xs text-gray-400">{filteredMapped.length} of {mapped.length} shown</span>
            </div>
            {/* Filter tabs */}
            <div className="flex gap-2">
              {([['all', `All (${mapped.length})`, '⬤'], ['online', `Online (${onlineCount})`, '🟢'], ['offline', `Offline (${offlineCount})`, '⚫']] as [FilterMode, string, string][]).map(([f, label, dot]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filter === f
                      ? f === 'online'  ? 'bg-green-100 text-green-800 border border-green-300'
                      : f === 'offline' ? 'bg-gray-100 text-gray-800 border border-gray-300'
                      : 'bg-zamtel-green text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>{dot}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {mapLoaded && (
            <div style={{ height: 520 }}>
              <MapContainer center={zambiaCentre} zoom={6} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Fly to newly captured GPS */}
                {lat && lng && <FlyTo lat={lat} lng={lng} />}

                {/* Saved mapped devices — coloured by online/offline */}
                {filteredMapped.map(d => {
                  const online = isOnline(d);
                  const pinColor = online ? '#00843D' : '#6B7280';
                  const borderColor = online ? '#00843D' : '#374151';
                  return (
                    <CircleMarker
                      key={d.id}
                      center={[d.mapLatitude, d.mapLongitude]}
                      radius={online ? 10 : 8}
                      pathOptions={{
                        color: borderColor,
                        fillColor: pinColor,
                        fillOpacity: online ? 0.9 : 0.55,
                        weight: online ? 2.5 : 1.5,
                      }}
                    >
                      <Popup maxWidth={270}>
                        <div className="text-sm space-y-1 p-1">
                          {/* Online/Offline badge */}
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900">{d.dealerCode}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                              online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                              {online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                          {(() => { const ls = lastSeen(d); return (
                            <div className="text-gray-400 text-xs">
                              Last seen: <strong className="text-gray-600">{ls.text}</strong>
                              {ls.source && <span className="ml-1 text-gray-400">({ls.source})</span>}
                            </div>
                          ); })()}
                          {d.msisdn && <div className="text-gray-400 text-xs font-mono">SIM: {d.msisdn}</div>}
                          {d.agentName  && <div className="text-gray-700">Agent: {d.agentName}</div>}
                          {d.phoneModel && <div className="text-gray-600">Model: {d.phoneModel}</div>}
                          {d.imei1      && <div className="text-gray-500 font-mono text-xs">IMEI1: {d.imei1}</div>}
                          {d.imei2      && <div className="text-gray-500 font-mono text-xs">IMEI2: {d.imei2}</div>}
                          <div className="border-t pt-1 mt-1">
                            {d.holderName    && <div className="font-semibold text-gray-800">👤 {d.holderName}</div>}
                            {d.holderNrc     && <div className="text-gray-600">NRC: {d.holderNrc}</div>}
                            {d.holderContact && <div className="text-gray-600">📞 {d.holderContact}</div>}
                          </div>
                          {d.province && <div className="text-gray-500">{d.province}</div>}
                          {d.mappedBy && <div className="text-gray-400 text-xs">Mapped by {d.mappedBy.name}</div>}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}

                {/* Preview pin for current GPS capture (before saving) */}
                {lat && lng && !saving && (
                  <CircleMarker
                    center={[lat, lng]}
                    radius={12}
                    pathOptions={{ color: '#E4007C', fillColor: '#E4007C', fillOpacity: 0.9, weight: 2 }}
                  >
                    <Popup>
                      <div className="text-sm font-semibold text-zamtel-pink">
                        📍 Current location{device ? ` — ${device.dealerCode}` : ''}
                      </div>
                    </Popup>
                  </CircleMarker>
                )}
              </MapContainer>
            </div>
          )}

          {/* Map legend */}
          <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="inline-block w-3 h-3 rounded-full bg-zamtel-green" />
              Online / Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />
              Offline / Inactive
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#DC2626' }} />
              Police report pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#D97706' }} />
              Damage pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-zamtel-pink" />
              Current GPS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
