import { NextResponse } from 'next/server';
import { query, queryOne, pool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rubrica_projeto_id, descricao, valor, data_despesa } = body;
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];

    const { verifyToken } = await import('@/lib/auth');
    const payload = token ? verifyToken(token) : null;
    const usuario_id = payload?.userId;

    if (!rubrica_projeto_id || !descricao || !valor || !data_despesa) {
      return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp
         LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [rubrica_projeto_id]
      );

      if (!rubrica) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Rubrica não encontrada' }, { status: 404 }); }
      if (rubrica.saldo < valor) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Saldo insuficiente', saldo_disponivel: rubrica.saldo }, { status: 400 }); }

      const lancamento = await queryOne(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [rubrica_projeto_id, descricao, valor, data_despesa, usuario_id]
      );

      await client.query('COMMIT');
      return NextResponse.json(lancamento, { status: 201 });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Create lancamento error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
