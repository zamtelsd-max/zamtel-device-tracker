import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { devicesRouter } from './routes/devices';
import { dashboardRouter } from './routes/dashboard';
import { usersRouter } from './routes/users';
import { exportRouter } from './routes/export';
import { networkRouter } from './routes/network';
import { prisma } from './utils/prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Trust Caddy reverse proxy — required for rate-limit + correct IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://zamtelsd-max.github.io',
    'https://depcxnwq.gensparkclaw.com',
  ],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'zamtel-device-tracker', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/devices', devicesRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/export', exportRouter);
app.use('/api/v1/network', networkRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`Zamtel Device Tracker backend running on port ${PORT}`);
});

// Keep Neon DB connection alive — ping every 4 min to prevent idle connection drops
setInterval(async () => {
  try { await prisma.$queryRaw`SELECT 1`; }
  catch (e) { console.error('DB keepalive failed:', e); }
}, 4 * 60 * 1000);

export default app;
