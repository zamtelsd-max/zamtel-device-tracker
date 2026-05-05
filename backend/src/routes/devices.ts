import { Router, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../utils/audit';

export const devicesRouter = Router();
devicesRouter.use(authenticate);

// GET /api/v1/devices/search?q=dealer_code
devicesRouter.get('/search', async (req: AuthRequest, res: Response) => {
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  const device = await prisma.device.findFirst({
    where: { dealerCode: { contains: q, mode: 'insensitive' } },
    include: { allocatedAuditor: { select: { id: true, name: true, username: true } } },
  });
  if (!device) return res.status(404).json({ error: 'Device not found' });
  return res.json(device);
});

// GET /api/v1/devices
devicesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, province, ase, auditor, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 200);
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (status) where.status = status;
  if (province) where.province = { contains: province as string, mode: 'insensitive' };
  if (ase) where.aseBdcTse = { contains: ase as string, mode: 'insensitive' };
  if (auditor) where.allocatedToAuditorId = auditor;

  // trade_auditors can only see their own devices or unassigned
  if (req.user!.role === 'trade_auditor') {
    where.OR = [
      { allocatedToAuditorId: req.user!.id },
      { allocatedToAuditorId: null },
    ];
  }

  const [total, devices] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        allocatedAuditor: { select: { id: true, name: true, username: true } },
      },
    }),
  ]);

  return res.json({ total, page: pageNum, limit: limitNum, data: devices });
});

// GET /api/v1/devices/:id
devicesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const device = await prisma.device.findUnique({
    where: { id: req.params.id },
    include: {
      allocatedAuditor: { select: { id: true, name: true, username: true } },
      followUps: {
        orderBy: { visitedAt: 'desc' },
        include: { auditor: { select: { id: true, name: true } } },
      },
      closureEvidences: {
        include: { backOffice: { select: { id: true, name: true } } },
      },
    },
  });
  if (!device) return res.status(404).json({ error: 'Device not found' });
  return res.json(device);
});

// POST /api/v1/devices/:id/assign
devicesRouter.post('/:id/assign', requireRoles('trade_auditor', 'project_lead'), async (req: AuthRequest, res: Response) => {
  const deviceId = req.params.id;
  const auditorId = req.user!.id;

  // Use a transaction to prevent race conditions
  try {
    const result = await prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({ where: { id: deviceId } });
      if (!device) throw { status: 404, message: 'Device not found' };
      if (device.allocatedToAuditorId && device.allocatedToAuditorId !== auditorId) {
        throw { status: 409, message: 'Device already assigned to another auditor' };
      }

      const updated = await tx.device.update({
        where: { id: deviceId },
        data: { allocatedToAuditorId: auditorId },
      });

      return updated;
    });

    await writeAuditLog({
      userId: auditorId,
      deviceId,
      action: 'ASSIGN_DEVICE',
      newValue: { auditorId },
      ipAddress: req.ip,
    });

    return res.json(result);
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Assign error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/devices/:id/followup
devicesRouter.post('/:id/followup', requireRoles('trade_auditor', 'project_lead'), async (req: AuthRequest, res: Response) => {
  const deviceId = req.params.id;
  const auditorId = req.user!.id;
  const { notes, reportedStatus, latitude, longitude, locationName } = req.body;

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const oldStatus = device.status;

    // Determine new device status based on reported status
    let newDeviceStatus = device.status;
    if (reportedStatus === 'lost_stolen') newDeviceStatus = 'pending_police_report';
    else if (reportedStatus === 'damaged') newDeviceStatus = 'pending_damage_verification';
    else if (reportedStatus === 'inactive_confirmed') newDeviceStatus = 'pending_ga_verification';

    const [followUp] = await prisma.$transaction([
      prisma.followUp.create({
        data: {
          deviceId,
          auditorId,
          notes,
          reportedStatus,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          locationName,
        },
      }),
      prisma.device.update({
        where: { id: deviceId },
        data: { status: newDeviceStatus, updatedAt: new Date() },
      }),
    ]);

    await writeAuditLog({
      userId: auditorId,
      deviceId,
      action: 'FOLLOWUP',
      oldValue: { status: oldStatus },
      newValue: { status: newDeviceStatus, reportedStatus },
      ipAddress: req.ip,
    });

    return res.json(followUp);
  } catch (err) {
    console.error('Follow-up error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/devices/:id/close
devicesRouter.post('/:id/close', requireRoles('back_office', 'project_lead'), async (req: AuthRequest, res: Response) => {
  const deviceId = req.params.id;
  const backOfficeId = req.user!.id;
  const { closureType, policeReportRef, receiptNumber, gaTransactionId, verifierName, notes } = req.body;

  if (!closureType) return res.status(400).json({ error: 'closureType required' });

  try {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const oldStatus = device.status;
    let newStatus: any = 'closed_inactive_resolved';
    if (closureType === 'lost_stolen') newStatus = 'closed_lost_stolen';
    else if (closureType === 'damaged') newStatus = 'closed_damaged';
    else if (closureType === 'inactive_resolved') newStatus = 'closed_inactive_resolved';

    const [evidence] = await prisma.$transaction([
      prisma.closureEvidence.create({
        data: {
          deviceId,
          backOfficeId,
          closureType,
          policeReportRef,
          receiptNumber,
          gaTransactionId,
          verifierName,
          notes,
        },
      }),
      prisma.device.update({
        where: { id: deviceId },
        data: { status: newStatus, updatedAt: new Date() },
      }),
    ]);

    await writeAuditLog({
      userId: backOfficeId,
      deviceId,
      action: 'CLOSE_DEVICE',
      oldValue: { status: oldStatus },
      newValue: { status: newStatus, closureType },
      ipAddress: req.ip,
    });

    return res.json(evidence);
  } catch (err) {
    console.error('Close error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
