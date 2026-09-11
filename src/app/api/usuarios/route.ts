import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { requireAuth, requireRole } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { createUsuarioSchema } from '@/lib/schemas';
import type { Usuario } from '@/types';

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const users = await query<Usuario>(
      'SELECT id, nome_completo, cpf, email, perfil, ativo, criado_em FROM usuarios ORDER BY criado_em DESC'
    );
    return NextResponse.json(users);
  } catch (error) {
    console.error('Get usuarios error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = createUsuarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { nome_completo, cpf, email, senha, perfil } = parsed.data;

    const existing = await queryOne('SELECT id FROM usuarios WHERE cpf = $1 OR email = $2', [cpf, email]);
    if (existing) {
      return NextResponse.json({ error: 'CPF ou email já cadastrado' }, { status: 409 });
    }

    const hash_senha = await hashPassword(senha);
    const user = await queryOne<Usuario>(
      `INSERT INTO usuarios (nome_completo, cpf, email, hash_senha, perfil)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome_completo, email, perfil, criado_em`,
      [nome_completo, cpf, email, hash_senha, perfil]
    );

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'CREATE', tabela_origem: 'usuarios', registro_id: String(user!.id), estado_posterior: { nome_completo, email, perfil }, endereco_ip: ip });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Create usuario error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
