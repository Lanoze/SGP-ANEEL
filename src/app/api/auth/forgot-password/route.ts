import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 });
    }

    const user = await queryOne<{ id: string }>('SELECT id FROM usuarios WHERE email = $1 AND ativo = true', [email]);

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: user?.id || 'unknown', acao: 'FORGOT_PASSWORD', tabela_origem: 'usuarios', registro_id: user?.id || 'unknown', estado_posterior: { email_solicitado: email, usuario_encontrado: !!user }, endereco_ip: ip });

    return NextResponse.json({ message: 'Se o email estiver cadastrado, um gestor poderá redefinir sua senha.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
