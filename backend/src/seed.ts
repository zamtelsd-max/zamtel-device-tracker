import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const UPLOAD_DIR = '/home/work/.openclaw/workspace/upload';

interface SeedUser {
  username: string;
  name: string;
  role: any;
  password: string;
}

const USERS: SeedUser[] = [
  { name: 'Chansa Bands', role: 'trade_auditor', username: 'cbands', password: 'Temp$Auditor2024!' },
  { name: 'Rita Mumba', role: 'trade_auditor', username: 'rmumba', password: 'Temp$Auditor2024!' },
  { name: 'Chileshe Mwaba', role: 'trade_auditor', username: 'cmwaba', password: 'Temp$Auditor2024!' },
  { name: 'Agness Yambayamba', role: 'trade_auditor', username: 'ayambayamba', password: 'Temp$Auditor2024!' },
  { name: 'Moshel Sokoni', role: 'trade_auditor', username: 'msokoni', password: 'Temp$Auditor2024!' },
  { name: 'Only Sikapila', role: 'project_lead', username: 'osikapila', password: 'Temp$Lead2024!' },
  { name: 'Lister Nayingwa', role: 'back_office', username: 'lnayingwa', password: 'Temp$BackOffice2024!' },
  { name: 'Machaliwa', role: 'back_office', username: 'machaliwa', password: 'Temp$BackOffice2024!' },
  { name: 'PM Admin', role: 'project_manager', username: 'pm_admin', password: 'Temp$Manager2024!' },
  { name: 'HOS Admin', role: 'head_of_sales', username: 'hos_admin', password: 'Temp$Sales2024!' },
];

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseDsaRetailer(val: any): 'DSA' | 'RETAILER' | null {
  const s = cleanStr(val).toUpperCase();
  if (s === 'DSA') return 'DSA';
  if (s === 'RETAILER' || s === 'RTL' || s === 'RETAIL') return 'RETAILER';
  return null;
}

async function seedUsers() {
  console.log('Seeding users...');
  let count = 0;
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, role: u.role, passwordHash },
      create: { username: u.username, name: u.name, role: u.role, passwordHash },
    });
    count++;
  }
  console.log(`✓ Seeded ${count} users`);
}

async function seedInactiveDevices() {
  console.log('\nSeeding inactive devices from "Inactive Codes.xlsx"...');
  const filePath = path.join(UPLOAD_DIR, 'Inactive Codes.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Headers on row 2, data starts row 3
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Start from row index 2 (row 3 in Excel, since row 2 has headers)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const dealerCode = cleanStr(row[0]);
    if (!dealerCode) { skipped++; continue; }

    const dsaOrRetailer = parseDsaRetailer(row[7]);

    const data = {
      agentName: cleanStr(row[1]) || null,
      msisdn: cleanStr(row[2]) || null,
      aseBdcTse: cleanStr(row[3]) || null,
      province: cleanStr(row[4]) || null,
      favouriteSite: cleanStr(row[5]) || null,
      teamLead: cleanStr(row[6]) || null,
      dsaOrRetailer: dsaOrRetailer,
      status: 'inactive' as const,
    };

    try {
      const existing = await prisma.device.findUnique({ where: { dealerCode } });
      if (existing) {
        await prisma.device.update({ where: { dealerCode }, data });
        updated++;
      } else {
        await prisma.device.create({ data: { dealerCode, ...data } });
        inserted++;
      }
    } catch (err: any) {
      console.error(`  Error on row ${i + 1} (${dealerCode}):`, err.message);
      skipped++;
    }
  }

  console.log(`✓ Inactive Codes: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
  return inserted + updated;
}

async function seedKycDevices() {
  console.log('\nSeeding KYC phone data from "KYC Phone List.xlsx"...');
  const filePath = path.join(UPLOAD_DIR, 'KYC Phone List.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Headers on row 1, data from row 2
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

  let matched = 0;
  let newInserted = 0;
  let skipped = 0;

  // Start from index 1 (row 2)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const phoneModel = cleanStr(row[0]);
    const imei1 = cleanStr(row[1]);
    const imei2 = cleanStr(row[2]);
    const msisdn = cleanStr(row[3]);
    const simSerial = cleanStr(row[4]);
    const region = cleanStr(row[5]);
    const rbm = cleanStr(row[6]);

    if (!msisdn && !imei1) { skipped++; continue; }

    const kycData = {
      phoneModel: phoneModel || null,
      imei1: imei1 || null,
      imei2: imei2 || null,
      simSerial: simSerial || null,
      region: region || null,
      rbm: rbm || null,
    };

    try {
      // Try to match existing device by MSISDN
      if (msisdn) {
        const existing = await prisma.device.findFirst({ where: { msisdn } });
        if (existing) {
          await prisma.device.update({ where: { id: existing.id }, data: kycData });
          matched++;
          continue;
        }
      }

      // No match — insert as new active device
      const dealerCode = `KYC-${imei1 || msisdn || i}`;
      const existing2 = await prisma.device.findUnique({ where: { dealerCode } });
      if (existing2) {
        await prisma.device.update({ where: { dealerCode }, data: { ...kycData, msisdn: msisdn || null } });
        matched++;
      } else {
        await prisma.device.create({
          data: {
            dealerCode,
            msisdn: msisdn || null,
            status: 'active',
            ...kycData,
          },
        });
        newInserted++;
      }
    } catch (err: any) {
      console.error(`  Error on KYC row ${i + 1}:`, err.message);
      skipped++;
    }
  }

  console.log(`✓ KYC Phone List: ${matched} matched/enriched, ${newInserted} new active devices, ${skipped} skipped`);
  return matched + newInserted;
}

async function main() {
  console.log('=== Zamtel Device Tracker Seed ===\n');

  await seedUsers();
  const inactiveCount = await seedInactiveDevices();
  const kycCount = await seedKycDevices();

  const totalDevices = await prisma.device.count();
  console.log(`\n=== Seed Complete ===`);
  console.log(`Total devices in DB: ${totalDevices}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Seed failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
