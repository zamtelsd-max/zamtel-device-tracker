import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Append connection pool settings to keep connections alive through Neon's idle timeout
const dbUrl = process.env.DATABASE_URL || '';
const pooledUrl = dbUrl.includes('?')
  ? dbUrl + '&connection_limit=5&pool_timeout=30'
  : dbUrl + '?connection_limit=5&pool_timeout=30';

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error'],
    datasources: { db: { url: pooledUrl } },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Reconnect on connection errors — Neon serverless closes idle connections after 5 min
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
