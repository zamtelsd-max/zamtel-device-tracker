import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';

export const usersRouter = Router();
usersRouter.use(authenticate);

// GET /api/v1/users
usersRouter.get('/', requireRoles('project_lead', 'project_manager'), async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  return res.json(users);
});

// POST /api/v1/users
usersRouter.post('/', requireRoles('project_lead'), async (req: AuthRequest, res: Response) => {
  const { username, name, role, password } = req.body;
  if (!username || !name || !role || !password) {
    return res.status(400).json({ error: 'username, name, role, password required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, name, role, passwordHash },
      select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return res.status(201).json(user);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/users/:id
usersRouter.patch('/:id', requireRoles('project_lead'), async (req: AuthRequest, res: Response) => {
  const { name, role, password, isActive } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, username: true, name: true, role: true, isActive: true, updatedAt: true },
    });
    return res.json(user);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
