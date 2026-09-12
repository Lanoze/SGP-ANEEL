import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { queryOne } from './db';
import type { JwtPayload, Usuario } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function authenticateUser(email: string, senha: string) {
  const user = await queryOne<Usuario>('SELECT * FROM usuarios WHERE email = $1 AND ativo = true', [email]);
  if (!user) return null;

  const valid = await bcrypt.compare(senha, user.hash_senha);
  if (!valid) return null;

  const token = signToken({ userId: user.id, email: user.email, perfil: user.perfil });
  return {
    token,
    usuario: {
      id: user.id,
      nome_completo: user.nome_completo,
      email: user.email,
      perfil: user.perfil,
    },
  };
}

export async function hashPassword(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}
