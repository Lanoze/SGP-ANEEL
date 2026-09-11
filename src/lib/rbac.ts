import { NextResponse } from 'next/server';
import { verifyToken } from './auth';
import type { RoleUsuario, JwtPayload } from '@/types';

const ROLE_HIERARCHY: Record<RoleUsuario, number> = {
  GESTOR: 4,
  COORDENADOR: 3,
  PESQUISADOR: 2,
  BOLSISTA: 1,
};

export function extractUser(request: Request): JwtPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}

export function requireAuth(request: Request): { user: JwtPayload; error?: NextResponse } {
  const user = extractUser(request);
  if (!user) return { user: null as unknown as JwtPayload, error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  return { user, error: undefined };
}

export function requireRole(request: Request, allowedRoles: RoleUsuario[]): { user: JwtPayload; error?: NextResponse } {
  const auth = requireAuth(request);
  if (auth.error) return auth;
  if (!allowedRoles.includes(auth.user.perfil)) {
    return { user: auth.user, error: NextResponse.json({ error: 'Acesso negado', required: allowedRoles }, { status: 403 }) };
  }
  return auth;
}

export function requireMinRole(request: Request, minRole: RoleUsuario): { user: JwtPayload; error?: NextResponse } {
  const auth = requireAuth(request);
  if (auth.error) return auth;
  const userLevel = ROLE_HIERARCHY[auth.user.perfil] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
  if (userLevel < requiredLevel) {
    return { user: auth.user, error: NextResponse.json({ error: 'Permissão insuficiente', required: minRole }, { status: 403 }) };
  }
  return auth;
}

export function canAccessContratosRH(perfil: RoleUsuario): boolean {
  return perfil === 'GESTOR' || perfil === 'COORDENADOR';
}

export function canViewAudit(perfil: RoleUsuario): boolean {
  return perfil === 'GESTOR';
}
