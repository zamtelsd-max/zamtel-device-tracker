/**
 * Network Activity Import
 * POST /api/v1/network/import
 *   - Accepts a CSV upload (multipart field "file") OR raw JSON body { rows: [{msisdn, lastActive}] }
 *   - Matches devices by MSISDN
 *   - Updates last_seen_at (network-derived) and optionally status
 *   - NEVER touches auditor-managed fields (holder_name, map_*, follow_ups, etc.)
 *
 * Status derivation rule:
 *   lastActive within 7 days  → status stays/becomes 'active'
 *   lastActive 8–30 days ago  → status stays/becomes 'inactive'
 *   lastActive > 30 days ago  → status stays/becomes 'inactive'
 *   (status only changes if it is currently 'active' or 'inactive';
 *    pending_* and closed_* statuses are NEVER overridden)
 */

import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { writeAuditLog } from '../utils/audit';

export const networkRouter = Router();
networkRouter.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── CSV parser (handles quoted fields, various date formats) ──────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// ── Detect MSISDN + lastActive columns by common names ───────────────────────
function detectColumns(headers: string[]): { msisdnCol: string | null; dateCol: string | null } {
  const msisdnCandidates = ['msisdn', 'mobile', 'phone', 'number', 'a_number', 'sim', 'subscriber', 'cli'];
  const dateCandidates   = ['last_active', 'last_seen', 'last_call', 'last_data', 'last_activity',
                             'lastactive', 'lastseen', 'activity_date', 'last_used', 'date'];
  const msisdnCol = headers.find(h => msisdnCandidates.some(c => h.includes(c))) || null;
  const dateCol   = headers.find(h => dateCandidates.some(c => h.includes(c)))   || null;
  return { msisdnCol, dateCol };
}

// ── Normalise MSISDN to 260XXXXXXXXX format ───────────────────────────────────
function normMsisdn(raw: string): string {
  let s = raw.replace(/\D/g, '');          // digits only
  if (s.startsWith('0') && s.length === 10) s = '260' + s.slice(1);
  if (s.startsWith('26') && s.length === 12) return s;
  return s;                                 // return as-is if unknown format
}

// ── Parse date string to Date ─────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  if (!s || s.trim() === '' || s.trim() === '-') return null;
  // Try ISO first, then DD/MM/YYYY, then DD-MM-YYYY
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    // Try DD/MM/YYYY
    const d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// ── Derive status from lastSeenAt (only for active/inactive devices) ──────────
function deriveStatus(lastSeenAt: Date, currentStatus: string): string {
  const PROTECTED = ['pending_police_report', 'pending_damage_verification', 'pending_ga_verification',
                     'closed_lost_stolen', 'closed_damaged', 'closed_inactive_resolved'];
  if (PROTECTED.includes(currentStatus)) return currentStatus;  // never override

  const daysAgo = (Date.now() - lastSeenAt.getTime()) / 86400000;
  return daysAgo <= 7 ? 'active' : 'inactive';
}

// ─── POST /api/v1/network/import ─────────────────────────────────────────────
networkRouter.post(
  '/import',
  requireRoles('project_lead', 'project_manager', 'head_of_sales'),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      let rows: { msisdn: string; lastActive: Date }[] = [];

      // ── A) JSON body: { rows: [{msisdn, lastActive}] }
      if (!req.file && req.body?.rows) {
        const raw = Array.isArray(req.body.rows) ? req.body.rows : JSON.parse(req.body.rows);
        for (const r of raw) {
          const d = parseDate(r.lastActive || r.last_active || r.date || '');
          if (d && r.msisdn) rows.push({ msisdn: normMsisdn(String(r.msisdn)), lastActive: d });
        }
      }

      // ── B) CSV file upload
      if (req.file) {
        const text = req.file.buffer.toString('utf-8');
        const csvRows = parseCSV(text);
        if (csvRows.length === 0) return res.status(400).json({ error: 'CSV is empty or could not be parsed' });

        const headers = Object.keys(csvRows[0]);
        const { msisdnCol, dateCol } = detectColumns(headers);
        if (!msisdnCol) return res.status(400).json({ error: 'Could not detect MSISDN column. Expected column names: msisdn, mobile, phone, number, a_number' });
        if (!dateCol)   return res.status(400).json({ error: 'Could not detect date column. Expected column names: last_active, last_seen, last_call, last_data, activity_date' });

        for (const r of csvRows) {
          const d = parseDate(r[dateCol] || '');
          if (d && r[msisdnCol]) rows.push({ msisdn: normMsisdn(r[msisdnCol]), lastActive: d });
        }
      }

      if (rows.length === 0) return res.status(400).json({ error: 'No valid MSISDN + date rows found in input' });

      // ── Match and update in batches ──────────────────────────────────────
      const BATCH = 100;
      let matched = 0, statusChanged = 0, skipped = 0;
      const summary: { msisdn: string; dealerCode: string; oldStatus: string; newStatus: string; lastSeenAt: string }[] = [];

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const msisdns = batch.map(r => r.msisdn);

        const devices = await prisma.device.findMany({
          where: { msisdn: { in: msisdns } },
          select: { id: true, msisdn: true, dealerCode: true, status: true },
        });

        if (devices.length === 0) { skipped += batch.length; continue; }

        const devMap = new Map(devices.map(d => [d.msisdn!, d]));

        for (const row of batch) {
          const device = devMap.get(row.msisdn);
          if (!device) { skipped++; continue; }

          matched++;
          const newStatus = deriveStatus(row.lastActive, device.status) as any;
          const statusChanging = newStatus !== device.status;
          if (statusChanging) statusChanged++;

          await prisma.device.update({
            where: { id: device.id },
            data: {
              lastSeenAt:     row.lastActive,
              lastSeenSource: 'network_import',
              ...(statusChanging ? { status: newStatus } : {}),
            },
          });

          summary.push({
            msisdn:      row.msisdn,
            dealerCode:  device.dealerCode,
            oldStatus:   device.status,
            newStatus,
            lastSeenAt:  row.lastActive.toISOString(),
          });
        }
      }

      await writeAuditLog({
        userId:   req.user!.id,
        deviceId: undefined,
        action:   'NETWORK_IMPORT',
        newValue: { totalRows: rows.length, matched, statusChanged, skipped },
        ipAddress: req.ip,
      });

      return res.json({
        success: true,
        stats: { totalRows: rows.length, matched, statusChanged, skipped, unmatched: rows.length - matched - skipped },
        preview: summary.slice(0, 50),   // first 50 for UI display
      });

    } catch (err) {
      console.error('Network import error:', err);
      return res.status(500).json({ error: 'Import failed', detail: String(err) });
    }
  }
);

// ─── GET /api/v1/network/status ─────────────────────────────────────────────
// Returns counts of devices by last_seen recency (for dashboard widget)
networkRouter.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const d7  = new Date(now.getTime() - 7  * 86400000);
    const d30 = new Date(now.getTime() - 30 * 86400000);

    const [seenWithin7, seenWithin30, neverSeen, total] = await Promise.all([
      prisma.device.count({ where: { lastSeenAt: { gte: d7  } } }),
      prisma.device.count({ where: { lastSeenAt: { gte: d30, lt: d7 } } }),
      prisma.device.count({ where: { lastSeenAt: null } }),
      prisma.device.count(),
    ]);

    const lastImport = await prisma.device.findFirst({
      where: { lastSeenSource: 'network_import', lastSeenAt: { not: null } },
      orderBy: { lastSeenAt: 'desc' },
      select: { lastSeenAt: true },
    });

    return res.json({
      total,
      seenWithin7days:  seenWithin7,
      seenWithin30days: seenWithin30,
      neverSeen,
      lastImportDate: lastImport?.lastSeenAt ?? null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load network status' });
  }
});
