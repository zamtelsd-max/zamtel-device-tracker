import React from 'react';
import { DeviceStatus } from '../types';
import { getStatusLabel, getStatusBadgeClass } from '../utils/statusHelpers';

interface Props {
  status: DeviceStatus;
}

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
}
