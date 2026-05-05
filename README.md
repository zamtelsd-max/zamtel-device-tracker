# Zamtel Trade Auditor Device Tracker

A comprehensive device tracking system for Zamtel trade auditors.

## Architecture

- **Backend**: Node.js + Express + TypeScript + Prisma + Neon PostgreSQL
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Leaflet maps
- **Deploy**: Railway (backend) + GitHub Pages (frontend)
- **Auth**: JWT + bcrypt + RBAC

## User Roles

| Role | Access |
|------|--------|
| `trade_auditor` | Pick devices, conduct field visits, capture GPS |
| `back_office` | Close workflows with evidence |
| `project_manager` | Read-only dashboards + reports |
| `head_of_sales` | Executive dashboard, all metrics |
| `project_lead` | Full admin + user management |

## Quick Start

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm install
VITE_API_URL=https://your-backend-url/api/v1 npm run build
npm run deploy
```

## Frontend
**GitHub Pages**: https://zamtelsd-max.github.io/zamtel-device-tracker

## API Base
`https://depcxnwq.gensparkclaw.com/dt-api/api/v1`
