import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';

export async function GET(request: Request, { params }: { params: Promise<{ rubrica_projeto_id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const { rubrica_projeto_id } = await params;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const lancamentos = await query(
      `SELECT l.*, u.nome_completo as usuario_nome
       FROM lancamentos l LEFT JOIN usuarios u ON l.usuario_registro_id = u.id
       WHERE l.rubrica_projeto_id = $1
       ORDER BY l.data_despesa DESC LIMIT $2 OFFSET $3`,
      [rubrica_projeto_id, limit, offset]
    );

    const total = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM lancamentos WHERE rubrica_projeto_id = $1',
      [rubrica_projeto_id]
    );

    return NextResponse.json({ data: lancamentos, pagination: { page, limit, total: parseInt(total?.count || '0') } });
  } catch (error) {
    console.error('Get lancamentos by rubrica error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
