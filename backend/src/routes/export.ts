import { Router, Response } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';

export const exportRouter = Router();
exportRouter.use(authenticate);
exportRouter.use(requireRoles('project_lead', 'project_manager', 'head_of_sales', 'back_office'));

// GET /api/v1/export/devices
exportRouter.get('/devices', async (req: AuthRequest, res: Response) => {
  try {
    const { status, province, ase, startDate, endDate } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (province) where.province = { contains: province as string, mode: 'insensitive' };
    if (ase) where.aseBdcTse = { contains: ase as string, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const devices = await prisma.device.findMany({
      where,
      include: {
        allocatedAuditor: { select: { name: true } },
        followUps: { orderBy: { visitedAt: 'desc' }, take: 1 },
        closureEvidences: { orderBy: { closedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Devices');

    sheet.columns = [
      { header: 'Dealer Code', key: 'dealerCode', width: 15 },
      { header: 'Agent Name', key: 'agentName', width: 25 },
      { header: 'MSISDN', key: 'msisdn', width: 15 },
      { header: 'ASE/BDC/TSE', key: 'aseBdcTse', width: 20 },
      { header: 'Province', key: 'province', width: 15 },
      { header: 'Favourite Site', key: 'favouriteSite', width: 20 },
      { header: 'Team Lead', key: 'teamLead', width: 20 },
      { header: 'DSA/Retailer', key: 'dsaOrRetailer', width: 12 },
      { header: 'IMEI 1', key: 'imei1', width: 20 },
      { header: 'IMEI 2', key: 'imei2', width: 20 },
      { header: 'SIM Serial', key: 'simSerial', width: 20 },
      { header: 'Phone Model', key: 'phoneModel', width: 20 },
      { header: 'Region', key: 'region', width: 15 },
      { header: 'RBM', key: 'rbm', width: 15 },
      { header: 'Status', key: 'status', width: 25 },
      { header: 'Assigned Auditor', key: 'assignedAuditor', width: 20 },
      { header: 'Last Follow-Up', key: 'lastFollowUp', width: 20 },
      { header: 'Closure Ref', key: 'closureRef', width: 20 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    // Style header row
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00843D' } };
    });

    for (const d of devices) {
      sheet.addRow({
        dealerCode: d.dealerCode,
        agentName: d.agentName || '',
        msisdn: d.msisdn || '',
        aseBdcTse: d.aseBdcTse || '',
        province: d.province || '',
        favouriteSite: d.favouriteSite || '',
        teamLead: d.teamLead || '',
        dsaOrRetailer: d.dsaOrRetailer || '',
        imei1: d.imei1 || '',
        imei2: d.imei2 || '',
        simSerial: d.simSerial || '',
        phoneModel: d.phoneModel || '',
        region: d.region || '',
        rbm: d.rbm || '',
        status: d.status,
        assignedAuditor: d.allocatedAuditor?.name || '',
        lastFollowUp: d.followUps[0]?.visitedAt?.toISOString().split('T')[0] || '',
        closureRef: d.closureEvidences[0]?.policeReportRef || d.closureEvidences[0]?.receiptNumber || '',
        createdAt: d.createdAt.toISOString().split('T')[0],
        updatedAt: d.updatedAt.toISOString().split('T')[0],
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="zamtel-devices-${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    return res.status(500).json({ error: 'Export failed' });
  }
});
