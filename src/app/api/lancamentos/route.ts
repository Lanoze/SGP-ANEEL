import { NextResponse } from 'next/server';
import { queryOne, pool, setAuditContext } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/rbac';
import { createLancamentoSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR', 'COORDENADOR']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = createLancamentoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { rubrica_projeto_id, descricao, valor, data_despesa } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setAuditContext(client, auth.user.userId);

      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp
         LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [rubrica_projeto_id]
      );

      if (!rubrica) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Rubrica não encontrada' }, { status: 404 }); }
      if (rubrica.saldo < valor) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Saldo insuficiente', saldo_disponivel: rubrica.saldo }, { status: 400 }); }

      const lancamento = await queryOne<{ id: string }>(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [rubrica_projeto_id, descricao, valor, data_despesa, auth.user.userId]
      );

      await client.query('COMMIT');

      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      await createAuditLog({ usuario_id: auth.user.userId, acao: 'CREATE', tabela_origem: 'lancamentos', registro_id: lancamento!.id, estado_posterior: { rubrica_projeto_id, descricao, valor, data_despesa }, endereco_ip: ip });

      return NextResponse.json(lancamento, { status: 201 });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Create lancamento error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
