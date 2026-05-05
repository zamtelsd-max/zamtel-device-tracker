export type UserRole = 'trade_auditor' | 'back_office' | 'project_manager' | 'head_of_sales' | 'project_lead';

export type DeviceStatus =
  | 'active'
  | 'inactive'
  | 'pending_police_report'
  | 'pending_damage_verification'
  | 'pending_ga_verification'
  | 'closed_lost_stolen'
  | 'closed_damaged'
  | 'closed_inactive_resolved';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: string;
}

export interface Device {
  id: string;
  dealerCode: string;
  agentName?: string;
  msisdn?: string;
  aseBdcTse?: string;
  province?: string;
  favouriteSite?: string;
  teamLead?: string;
  dsaOrRetailer?: 'DSA' | 'RETAILER';
  imei1?: string;
  imei2?: string;
  simSerial?: string;
  phoneModel?: string;
  region?: string;
  rbm?: string;
  status: DeviceStatus;
  allocatedToAuditorId?: string;
  allocatedAuditor?: { id: string; name: string; username: string } | null;
  followUps?: FollowUp[];
  closureEvidences?: ClosureEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  deviceId: string;
  auditorId: string;
  notes?: string;
  reportedStatus?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  visitedAt: string;
  createdAt: string;
  auditor?: { id: string; name: string };
}

export interface ClosureEvidence {
  id: string;
  deviceId: string;
  backOfficeId: string;
  closureType: 'lost_stolen' | 'damaged' | 'inactive_resolved';
  policeReportRef?: string;
  receiptNumber?: string;
  gaTransactionId?: string;
  verifierName?: string;
  notes?: string;
  closedAt: string;
  backOffice?: { id: string; name: string };
}

export interface DashboardStats {
  total: number;
  active: number;
  inactive: number;
  pendingActions: number;
  pending: { police: number; damage: number; ga: number };
  closed: number;
  closedBreakdown: { lostStolen: number; damaged: number; inactiveResolved: number };
  byRole: { dsa: number; retailer: number };
  byProvince: { province: string; count: number }[];
}

export interface MapPoint {
  latitude: number;
  longitude: number;
  locationName?: string;
  visitedAt: string;
  device: {
    id: string;
    dealerCode: string;
    agentName?: string;
    status: DeviceStatus;
    province?: string;
  };
}
