import { NextResponse } from 'next/server';
import { query, queryOne, pool } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projeto_id, ano, mes } = body;
    if (!projeto_id || !ano || !mes) return NextResponse.json({ error: 'Dados obrigatórios faltando' }, { status: 400 });

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    const { verifyToken } = await import('@/lib/auth');
    const payload = token ? verifyToken(token) : null;
    const usuario_id = payload?.userId;

    if (!usuario_id) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    if (payload?.perfil !== 'GESTOR' && payload?.perfil !== 'COORDENADOR') {
      return NextResponse.json({ error: 'Apenas gestores e coordenadores podem fazer baixa em lote' }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const competencias = await query<{ id: string; valor_devido: number; rubrica_projeto_id: string }>(
        `SELECT cf.*, rp.id as rubrica_projeto_id
         FROM competencias_folha cf
         JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
         JOIN rubricas_projeto rp ON rp.projeto_id = a.projeto_id AND rp.rubrica = 'RH'
         WHERE a.projeto_id = $1 AND cf.ano = $2 AND cf.mes = $3 AND cf.status = 'PENDENTE'`,
        [projeto_id, ano, mes]
      );

      if (competencias.length === 0) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Nenhuma competência pendente' }, { status: 404 }); }

      const totalFolha = competencias.reduce((sum, c) => sum + parseFloat(String(c.valor_devido)), 0);
      const rubrica_projeto_id = competencias[0].rubrica_projeto_id;

      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [rubrica_projeto_id]
      );

      if (!rubrica || rubrica.saldo < totalFolha) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Saldo RH insuficiente' }, { status: 400 }); }

      const saldoAnterior = rubrica.saldo;

      await client.query(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
        [rubrica_projeto_id, `Baixa em lote folha - ${mes}/${ano}`, totalFolha, usuario_id]
      );

      for (const comp of competencias) {
        await client.query(
          `UPDATE competencias_folha SET status = 'PAGO', data_baixa = CURRENT_TIMESTAMP, usuario_baixa_id = $1 WHERE id = $2`,
          [usuario_id, comp.id]
        );
      }

      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
      await createAuditLog({
        usuario_id,
        acao: 'BAIXA_LOTE',
        tabela_origem: 'competencias_folha',
        registro_id: competencias[0].id,
        estado_anterior: { competencias_pendentes: competencias.length, saldo_rh: saldoAnterior },
        estado_posterior: { competencias_liquidadas: competencias.length, total: totalFolha, saldo_rh: saldoAnterior - totalFolha },
        endereco_ip: ip,
      });

      await client.query('COMMIT');
      return NextResponse.json({ message: 'Baixa em lote realizada', competencias_liquidadas: competencias.length, total: totalFolha });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Baixa lote error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
