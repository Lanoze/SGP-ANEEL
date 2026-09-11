import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import type { Usuario } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome_completo, cpf, email, senha, perfil } = body;

    if (!nome_completo || !cpf || !email || !senha || !perfil) {
      return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 });
    }

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

    await createAuditLog({ acao: 'CREATE', tabela_origem: 'usuarios', registro_id: String(user!.id), estado_posterior: { nome_completo, email, perfil } });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Create usuario error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const users = await query<Usuario>(
      'SELECT id, nome_completo, cpf, email, perfil, ativo, criado_em FROM usuarios ORDER BY criado_em DESC'
    );
    return NextResponse.json(users);
  } catch (error) {
    console.error('Get usuarios error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
