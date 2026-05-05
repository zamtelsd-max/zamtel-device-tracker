import { DeviceStatus } from '../types';

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending_police_report: 'Pending Police Report',
  pending_damage_verification: 'Pending Damage Verification',
  pending_ga_verification: 'Pending GA Verification',
  closed_lost_stolen: 'Closed – Lost/Stolen',
  closed_damaged: 'Closed – Damaged',
  closed_inactive_resolved: 'Closed – Inactive Resolved',
};

export const STATUS_COLORS: Record<DeviceStatus, string> = {
  active: '#00843D',
  inactive: '#F59E0B',
  pending_police_report: '#7C3AED',
  pending_damage_verification: '#EA580C',
  pending_ga_verification: '#0D9488',
  closed_lost_stolen: '#6B7280',
  closed_damaged: '#6B7280',
  closed_inactive_resolved: '#6B7280',
};

export const STATUS_BADGE_CLASSES: Record<DeviceStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-amber-100 text-amber-800',
  pending_police_report: 'bg-purple-100 text-purple-800',
  pending_damage_verification: 'bg-orange-100 text-orange-800',
  pending_ga_verification: 'bg-teal-100 text-teal-800',
  closed_lost_stolen: 'bg-gray-100 text-gray-700',
  closed_damaged: 'bg-gray-100 text-gray-700',
  closed_inactive_resolved: 'bg-gray-100 text-gray-700',
};

export function getStatusLabel(status: DeviceStatus): string {
  return STATUS_LABELS[status] || status;
}

export function getStatusBadgeClass(status: DeviceStatus): string {
  return STATUS_BADGE_CLASSES[status] || 'bg-gray-100 text-gray-700';
}
