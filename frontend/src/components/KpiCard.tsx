import React from 'react';

interface Props {
  label: string;
  value: number | string;
  icon: string;
  color?: string;
  sub?: string;
}

export default function KpiCard({ label, value, icon, color = 'green', sub }: Props) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  return (
    <div className={`rounded-xl border-2 p-5 flex items-center gap-4 ${colorMap[color] || colorMap.green}`}>
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm font-medium opacity-80">{label}</div>
        {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
