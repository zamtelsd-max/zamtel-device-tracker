import { prisma } from '../utils/prisma';

export async function writeAuditLog(params: {
  userId: string;
  deviceId?: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        action: params.action,
        oldValue: params.oldValue || undefined,
        newValue: params.newValue || undefined,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
