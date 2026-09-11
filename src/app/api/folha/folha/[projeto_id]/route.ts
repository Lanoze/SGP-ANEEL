import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ projeto_id: string }> }) {
  try {
    const { projeto_id } = await params;
    const folha = await query(
      `SELECT a.*, u.nome_completo, u.cpf,
         (SELECT json_agg(json_build_object(
           'id', cf.id, 'ano', cf.ano, 'mes', cf.mes,
           'valor_devido', cf.valor_devido, 'status', cf.status,
           'data_baixa', cf.data_baixa
         ) ORDER BY cf.ano, cf.mes)
         FROM competencias_folha cf WHERE cf.alocacao_rh_id = a.id) as competencias
       FROM alocacao_rh a LEFT JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.projeto_id = $1 ORDER BY u.nome_completo`,
      [projeto_id]
    );
    return NextResponse.json(folha);
  } catch (error) {
    console.error('Get folha error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
