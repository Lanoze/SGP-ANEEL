import { NextResponse } from 'next/server';
import { queryOne, pool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { competencia_id } = body;
    if (!competencia_id) return NextResponse.json({ error: 'competencia_id obrigatório' }, { status: 400 });

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    const { verifyToken } = await import('@/lib/auth');
    const payload = token ? verifyToken(token) : null;
    const usuario_id = payload?.userId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const competencia = await queryOne<{ id: string; valor_devido: number; rubrica_projeto_id: string; mes: number; ano: number }>(
        `SELECT cf.*, rp.id as rubrica_projeto_id
         FROM competencias_folha cf
         JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
         JOIN rubricas_projeto rp ON rp.projeto_id = a.projeto_id AND rp.rubrica = 'RH'
         WHERE cf.id = $1 AND cf.status = 'PENDENTE'`,
        [competencia_id]
      );

      if (!competencia) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Competência não encontrada ou já liquidada' }, { status: 404 }); }

      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [competencia.rubrica_projeto_id]
      );

      if (!rubrica || rubrica.saldo < competencia.valor_devido) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Saldo RH insuficiente' }, { status: 400 }); }

      await client.query(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
        [competencia.rubrica_projeto_id, `Baixa folha - competência ${competencia.mes}/${competencia.ano}`, competencia.valor_devido, usuario_id]
      );

      await client.query(
        `UPDATE competencias_folha SET status = 'PAGO', data_baixa = CURRENT_TIMESTAMP, usuario_baixa_id = $1 WHERE id = $2`,
        [usuario_id, competencia_id]
      );

      await client.query('COMMIT');
      return NextResponse.json({ message: 'Liquidação realizada com sucesso' });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Baixa individual error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
