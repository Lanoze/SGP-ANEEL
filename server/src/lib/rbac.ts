import { verifyToken } from './auth';
import type { RoleUsuario, JwtPayload } from './types';
import { Request, Response, NextFunction } from 'express';

const ROLE_HIERARCHY: Record<RoleUsuario, number> = {
  GESTOR: 4,
  COORDENADOR: 3,
  PESQUISADOR: 2,
  BOLSISTA: 1,
};

export function extractUser(req: Request): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  req.user = user;
  next();
}

export function requireRole(allowedRoles: RoleUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = extractUser(req);
    if (!user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (!allowedRoles.includes(user.perfil)) {
      res.status(403).json({ error: 'Acesso negado', required: allowedRoles });
      return;
    }
    req.user = user;
    next();
  };
}

export function requireMinRole(minRole: RoleUsuario) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = extractUser(req);
    if (!user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    const userLevel = ROLE_HIERARCHY[user.perfil] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Permissão insuficiente', required: minRole });
      return;
    }
    req.user = user;
    next();
  };
}

export function canAccessContratosRH(perfil: RoleUsuario, projetoId?: string, userId?: string, coordenadorId?: string): boolean {
  if (perfil === 'GESTOR') return true;
  if (perfil === 'COORDENADOR' && projetoId && userId && coordenadorId) {
    return userId === coordenadorId;
  }
  return false;
}
