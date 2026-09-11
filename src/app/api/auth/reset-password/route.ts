import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { resetPasswordSchema } from '@/lib/schemas';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { usuario_id, nova_senha } = parsed.data;

    const user = await queryOne<{ id: string; nome_completo: string }>('SELECT id, nome_completo FROM usuarios WHERE id = $1', [usuario_id]);
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    const hash = await hashPassword(nova_senha);
    await queryOne('UPDATE usuarios SET hash_senha = $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id', [hash, usuario_id]);

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'RESET_SENHA', tabela_origem: 'usuarios', registro_id: usuario_id, estado_posterior: { resetado_por: auth.user.userId, usuario_nome: user.nome_completo }, endereco_ip: ip });

    return NextResponse.json({ message: `Senha de ${user.nome_completo} redefinida com sucesso` });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
