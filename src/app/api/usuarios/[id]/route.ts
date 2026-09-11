import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import type { Usuario } from '@/types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await queryOne<Usuario>(
      'SELECT id, nome_completo, cpf, email, perfil, ativo, criado_em FROM usuarios WHERE id = $1',
      [id]
    );
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    console.error('Get usuario error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
