import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { MapPoint } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../utils/statusHelpers';
import api from '../utils/api';

interface MappedDevice {
  id: string; dealerCode: string; agentName?: string; phoneModel?: string;
  province?: string; status: string;
  holderName?: string; holderNrc?: string; holderContact?: string;
  mapLatitude: number; mapLongitude: number; mappedAt?: string; updatedAt?: string;
  mappedBy?: { name: string };
}

const isOnline = (d: MappedDevice) => d.status === 'active';

export default function DeviceMap() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [mapped, setMapped] = useState<MappedDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/map'),
      api.get('/devices/mapped').catch(() => ({ data: [] })),
    ])
      .then(([r1, r2]) => { setPoints(r1.data); setMapped(r2.data); })
      .catch(err => console.error('Map data error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zamtel-green" />
      </div>
    );
  }

  // Zambia centre
  const centre: [number, number] = [-13.5, 28.5];

  return (
    <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
      <MapContainer center={centre} zoom={6} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Follow-up visit pins */}
        {points.map((point, idx) => (
          <CircleMarker
            key={`fu-${idx}`}
            center={[point.latitude, point.longitude]}
            radius={7}
            pathOptions={{
              color: STATUS_COLORS[point.device.status] || '#6B7280',
              fillColor: STATUS_COLORS[point.device.status] || '#6B7280',
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{point.device.dealerCode}</div>
                <div>{point.device.agentName}</div>
                <div className="capitalize text-gray-600">{STATUS_LABELS[point.device.status]}</div>
                {point.locationName && <div className="text-gray-500">{point.locationName}</div>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {/* Holder-mapped device pins — green = online, grey = offline */}
        {mapped.map(d => {
          const online = isOnline(d);
          return (
            <CircleMarker
              key={`md-${d.id}`}
              center={[d.mapLatitude, d.mapLongitude]}
              radius={online ? 10 : 8}
              pathOptions={{
                color: online ? '#00843D' : '#374151',
                fillColor: online ? '#00843D' : '#6B7280',
                fillOpacity: online ? 0.9 : 0.55,
                weight: 2.5,
              }}
            >
              <Popup maxWidth={240}>
                <div className="text-sm space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{d.dealerCode}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {online ? '🟢 Online' : '⚫ Offline'}
                    </span>
                  </div>
                  {d.agentName  && <div>{d.agentName}</div>}
                  {d.phoneModel && <div className="text-gray-500">{d.phoneModel}</div>}
                  <div className="border-t pt-1 mt-1">
                    {d.holderName    && <div className="font-semibold">👤 {d.holderName}</div>}
                    {d.holderNrc     && <div className="text-gray-600 text-xs">NRC: {d.holderNrc}</div>}
                    {d.holderContact && <div className="text-gray-600 text-xs">📞 {d.holderContact}</div>}
                  </div>
                  {d.province && <div className="text-gray-400 text-xs">{d.province}</div>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{STATUS_LABELS[status as any]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 font-semibold">
          <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#E4007C', backgroundColor: '#6B7280' }} />
          <span className="text-gray-700">Mapped ({mapped.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-gray-500">Follow-ups ({points.length})</span>
        </div>
      </div>
    </div>
  );
}
