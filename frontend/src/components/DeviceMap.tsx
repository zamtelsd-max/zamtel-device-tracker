import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { MapPoint } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../utils/statusHelpers';
import api from '../utils/api';

export default function DeviceMap() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/map')
      .then(res => setPoints(res.data))
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
        {points.map((point, idx) => (
          <CircleMarker
            key={idx}
            center={[point.latitude, point.longitude]}
            radius={8}
            pathOptions={{
              color: STATUS_COLORS[point.device.status] || '#6B7280',
              fillColor: STATUS_COLORS[point.device.status] || '#6B7280',
              fillOpacity: 0.8,
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
      </MapContainer>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{STATUS_LABELS[status as any]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
