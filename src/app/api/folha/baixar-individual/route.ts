import { NextResponse } from 'next/server';
import { queryOne, pool, setAuditContext } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/rbac';
import { baixaCompetenciaSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR', 'COORDENADOR']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = baixaCompetenciaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { competencia_id } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setAuditContext(client, auth.user.userId);

      const competencia = await queryOne<{ id: string; valor_devido: number; rubrica_projeto_id: string; mes: number; ano: number; projeto_coordenador_id: string }>(
        `SELECT cf.*, rp.id as rubrica_projeto_id, p.coordenador_id as projeto_coordenador_id
         FROM competencias_folha cf
         JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
         JOIN rubricas_projeto rp ON rp.projeto_id = a.projeto_id AND rp.rubrica = 'RH'
         JOIN projetos p ON p.id = a.projeto_id
         WHERE cf.id = $1 AND cf.status = 'PENDENTE'`,
        [competencia_id]
      );

      if (!competencia) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Competência não encontrada ou já liquidada' }, { status: 404 }); }

      if (auth.user.perfil === 'COORDENADOR' && competencia.projeto_coordenador_id !== auth.user.userId) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Coordenador não é responsável por este projeto' }, { status: 403 });
      }

      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [competencia.rubrica_projeto_id]
      );

      if (!rubrica || rubrica.saldo < competencia.valor_devido) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Saldo RH insuficiente' }, { status: 400 }); }

      const saldoAnterior = rubrica.saldo;

      await client.query(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
        [competencia.rubrica_projeto_id, `Baixa folha - competência ${competencia.mes}/${competencia.ano}`, competencia.valor_devido, auth.user.userId]
      );

      await client.query(
        `UPDATE competencias_folha SET status = 'PAGO', data_baixa = CURRENT_TIMESTAMP, usuario_baixa_id = $1 WHERE id = $2`,
        [auth.user.userId, competencia_id]
      );

      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      await createAuditLog({
        usuario_id: auth.user.userId,
        acao: 'BAIXA_INDIVIDUAL',
        tabela_origem: 'competencias_folha',
        registro_id: competencia_id,
        estado_anterior: { status: 'PENDENTE', valor: competencia.valor_devido, saldo_rh: saldoAnterior },
        estado_posterior: { status: 'PAGO', saldo_rh: saldoAnterior - competencia.valor_devido },
        endereco_ip: ip,
      });

      await client.query('COMMIT');
      return NextResponse.json({ message: 'Liquidação realizada com sucesso' });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Baixa individual error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
