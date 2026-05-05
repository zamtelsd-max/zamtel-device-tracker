import { Router, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

// GET /api/v1/dashboard/stats
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [
      total,
      active,
      inactive,
      pendingPolice,
      pendingDamage,
      pendingGA,
      closedLostStolen,
      closedDamaged,
      closedInactive,
      byDsa,
      byRetailer,
    ] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: 'active' } }),
      prisma.device.count({ where: { status: 'inactive' } }),
      prisma.device.count({ where: { status: 'pending_police_report' } }),
      prisma.device.count({ where: { status: 'pending_damage_verification' } }),
      prisma.device.count({ where: { status: 'pending_ga_verification' } }),
      prisma.device.count({ where: { status: 'closed_lost_stolen' } }),
      prisma.device.count({ where: { status: 'closed_damaged' } }),
      prisma.device.count({ where: { status: 'closed_inactive_resolved' } }),
      prisma.device.count({ where: { dsaOrRetailer: 'DSA' } }),
      prisma.device.count({ where: { dsaOrRetailer: 'RETAILER' } }),
    ]);

    const pendingActions = pendingPolice + pendingDamage + pendingGA;
    const closed = closedLostStolen + closedDamaged + closedInactive;

    // Province breakdown
    const byProvince = await prisma.device.groupBy({
      by: ['province'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return res.json({
      total,
      active,
      inactive,
      pendingActions,
      pending: { police: pendingPolice, damage: pendingDamage, ga: pendingGA },
      closed,
      closedBreakdown: { lostStolen: closedLostStolen, damaged: closedDamaged, inactiveResolved: closedInactive },
      byRole: { dsa: byDsa, retailer: byRetailer },
      byProvince: byProvince.map(p => ({ province: p.province || 'Unknown', count: p._count.id })),
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/dashboard/map
dashboardRouter.get('/map', async (req: AuthRequest, res: Response) => {
  try {
    const followUps = await prisma.followUp.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        latitude: true,
        longitude: true,
        locationName: true,
        visitedAt: true,
        device: {
          select: {
            id: true,
            dealerCode: true,
            agentName: true,
            status: true,
            province: true,
          },
        },
      },
      orderBy: { visitedAt: 'desc' },
      take: 2000,
    });

    return res.json(followUps);
  } catch (err) {
    console.error('Map error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/dashboard/allocation
dashboardRouter.get('/allocation', async (req: AuthRequest, res: Response) => {
  try {
    const byAse = await prisma.device.groupBy({
      by: ['aseBdcTse', 'status'],
      _count: { id: true },
      orderBy: { aseBdcTse: 'asc' },
    });

    // Aggregate by ASE
    const aseMap: Record<string, any> = {};
    for (const row of byAse) {
      const ase = row.aseBdcTse || 'Unassigned';
      if (!aseMap[ase]) aseMap[ase] = { ase, total: 0, active: 0, inactive: 0, pending: 0, closed: 0 };
      aseMap[ase].total += row._count.id;
      if (row.status === 'active') aseMap[ase].active += row._count.id;
      else if (row.status === 'inactive') aseMap[ase].inactive += row._count.id;
      else if (['pending_police_report','pending_damage_verification','pending_ga_verification'].includes(row.status)) aseMap[ase].pending += row._count.id;
      else if (row.status.startsWith('closed_')) aseMap[ase].closed += row._count.id;
    }

    return res.json(Object.values(aseMap));
  } catch (err) {
    console.error('Allocation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/dashboard/auditor-summary
dashboardRouter.get('/auditor-summary', async (req: AuthRequest, res: Response) => {
  try {
    // All trade auditors
    const auditors = await prisma.user.findMany({
      where: { role: 'trade_auditor' },
      select: { id: true, name: true, username: true },
    });

    // All devices that have been assigned — raw query to avoid TS circular type issue with groupBy+where
    const deviceGroups = await prisma.$queryRaw<Array<{auditor_id: string, status: string, cnt: bigint}>>`
      SELECT allocated_to_auditor_id as auditor_id, status, COUNT(*)::int as cnt
      FROM dt.devices
      WHERE allocated_to_auditor_id IS NOT NULL
      GROUP BY allocated_to_auditor_id, status
    `;

    // Build a map: auditorId -> status counts
    const auditorMap: Record<string, any> = {};
    for (const aud of auditors) {
      auditorMap[aud.id] = {
        id: aud.id,
        name: aud.name,
        username: aud.username,
        total: 0,
        active: 0,
        inactive: 0,
        pendingPolice: 0,
        pendingDamage: 0,
        pendingGA: 0,
        closed: 0,
      };
    }

    for (const row of deviceGroups) {
      const aid = row.auditor_id;
      if (!auditorMap[aid]) continue;
      const count = Number(row.cnt);
      auditorMap[aid].total += count;
      if (row.status === 'active') auditorMap[aid].active += count;
      else if (row.status === 'inactive') auditorMap[aid].inactive += count;
      else if (row.status === 'pending_police_report') auditorMap[aid].pendingPolice += count;
      else if (row.status === 'pending_damage_verification') auditorMap[aid].pendingDamage += count;
      else if (row.status === 'pending_ga_verification') auditorMap[aid].pendingGA += count;
      else if (row.status.startsWith('closed_')) auditorMap[aid].closed += count;
    }

    // Also count follow-ups per auditor
    const followUpCounts = await prisma.$queryRaw<Array<{auditor_id: string, cnt: bigint}>>`
      SELECT auditor_id, COUNT(*)::int as cnt FROM dt.follow_ups GROUP BY auditor_id
    `;
    const fuMap: Record<string, number> = {};
    for (const f of followUpCounts) fuMap[f.auditor_id] = Number(f.cnt);

    const result = Object.values(auditorMap).map((a: any) => ({
      ...a,
      followUps: fuMap[a.id] || 0,
    }));

    return res.json(result);
  } catch (err) {
    console.error('Auditor summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/dashboard/pending-closures
dashboardRouter.get('/pending-closures', async (req: AuthRequest, res: Response) => {
  try {
    const pending = await prisma.device.findMany({
      where: {
        status: {
          in: ['pending_police_report', 'pending_damage_verification', 'pending_ga_verification'],
        },
      },
      include: {
        allocatedAuditor: { select: { id: true, name: true, username: true } },
        followUps: {
          orderBy: { visitedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'asc' },
    });

    return res.json(pending);
  } catch (err) {
    console.error('Pending closures error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
