import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/rbac';

export async function GET(request: Request, { params }: { params: Promise<{ alocacao_id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const { alocacao_id } = await params;
    const competencias = await query(
      `SELECT cf.*, u.nome_completo as usuario_baixa_nome
       FROM competencias_folha cf LEFT JOIN usuarios u ON cf.usuario_baixa_id = u.id
       WHERE cf.alocacao_rh_id = $1 ORDER BY cf.ano, cf.mes`,
      [alocacao_id]
    );
    return NextResponse.json(competencias);
  } catch (error) {
    console.error('Get competencias error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
