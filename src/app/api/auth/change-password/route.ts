import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/schemas';
import bcrypt from 'bcrypt';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { senha_atual, nova_senha } = parsed.data;

    const user = await queryOne<{ hash_senha: string }>('SELECT hash_senha FROM usuarios WHERE id = $1', [auth.user.userId]);
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const valid = await bcrypt.compare(senha_atual, user.hash_senha);
    if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });

    const hash = await hashPassword(nova_senha);
    await queryOne('UPDATE usuarios SET hash_senha = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id', [hash, auth.user.userId]);

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'UPDATE_SENHA', tabela_origem: 'usuarios', registro_id: auth.user.userId, estado_posterior: { alterada: true }, endereco_ip: ip });

    return NextResponse.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
