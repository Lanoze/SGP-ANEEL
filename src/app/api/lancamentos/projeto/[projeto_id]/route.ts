import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ projeto_id: string }> }) {
  try {
    const { projeto_id } = await params;
    const lancamentos = await query(
      `SELECT l.*, u.nome_completo as usuario_nome, rp.rubrica
       FROM lancamentos l
       LEFT JOIN usuarios u ON l.usuario_registro_id = u.id
       LEFT JOIN rubricas_projeto rp ON l.rubrica_projeto_id = rp.id
       WHERE rp.projeto_id = $1 ORDER BY l.data_despesa DESC`,
      [projeto_id]
    );
    return NextResponse.json(lancamentos);
  } catch (error) {
    console.error('Get lancamentos error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
