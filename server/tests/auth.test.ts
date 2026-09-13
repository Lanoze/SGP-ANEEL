import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const JWT_EXPIRES_IN = '24h';

function signToken(payload: { userId: string; email: string; perfil: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

function verifyToken(token: string): { userId: string; email: string; perfil: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; perfil: string };
  } catch {
    return null;
  }
}

describe('JWT sign/verify', () => {
  const payload = { userId: '550e8400-e29b-41d4-a716-446655440000', email: 'test@example.com', perfil: 'GESTOR' };

  it('signs and verifies a valid token', () => {
    const token = signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(payload.userId);
    expect(decoded!.email).toBe(payload.email);
    expect(decoded!.perfil).toBe(payload.perfil);
  });

  it('rejects invalid token', () => {
    expect(verifyToken('invalid.token.here')).toBeNull();
  });

  it('rejects token signed with different secret', () => {
    const wrongToken = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
    expect(verifyToken(wrongToken)).toBeNull();
  });

  it('rejects expired token', () => {
    const expiredToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' } as jwt.SignOptions);
    expect(verifyToken(expiredToken)).toBeNull();
  });

  it('produces different tokens for different users', () => {
    const token1 = signToken({ ...payload, userId: 'user-1' });
    const token2 = signToken({ ...payload, userId: 'user-2' });
    expect(token1).not.toBe(token2);
  });
});

describe('bcrypt password hashing', async () => {
  const bcrypt = await import('bcryptjs');

  it('hashes password and verifies correctly', async () => {
    const senha = 'minha-senha-segura';
    const hash = await bcrypt.hash(senha, 12);
    expect(hash).not.toBe(senha);
    expect(hash.length).toBeGreaterThan(50);

    const valid = await bcrypt.compare(senha, hash);
    expect(valid).toBe(true);

    const invalid = await bcrypt.compare('senha-errada', hash);
    expect(invalid).toBe(false);
  });

  it('produces different hashes for same password (salt)', async () => {
    const hash1 = await bcrypt.hash('test', 12);
    const hash2 = await bcrypt.hash('test', 12);
    expect(hash1).not.toBe(hash2);
  });
});
