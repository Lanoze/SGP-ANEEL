import { Router } from 'express';
import { query, queryOne, pool, setAuditContext } from '../lib/db';
import { createAuditLog } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/rbac';
import { createLancamentoSchema } from '../lib/schemas';
import type { Lancamento } from '../lib/types';

const router = Router();

router.post('/', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = (req as any).user;
    const parsed = createLancamentoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { rubrica_projeto_id, descricao, valor, data_despesa } = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId);
      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp
         LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [rubrica_projeto_id]
      );
      if (!rubrica) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Rubrica não encontrada' }); return; }
      if (rubrica.saldo < valor) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Saldo insuficiente', saldo_disponivel: rubrica.saldo }); return; }
      const lancamento = await queryOne<Lancamento>(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [rubrica_projeto_id, descricao, valor, data_despesa, user.userId]
      );
      await client.query('COMMIT');
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({ usuario_id: user.userId, acao: 'CREATE', tabela_origem: 'lancamentos', registro_id: lancamento!.id, estado_posterior: { rubrica_projeto_id, descricao, valor, data_despesa }, endereco_ip: String(ip) });
      res.status(201).json(lancamento);
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Create lancamento error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/rubrica/:rubrica_projeto_id', requireAuth, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page)) || 1;
    const limit = parseInt(String(req.query.limit)) || 20;
    const offset = (page - 1) * limit;
    const lancamentos = await query<Lancamento & { total: number }>(
      `SELECT l.*, u.nome_completo as usuario_nome, COUNT(*) OVER() as total
       FROM lancamentos l LEFT JOIN usuarios u ON l.usuario_registro_id = u.id
       WHERE l.rubrica_projeto_id = $1
       ORDER BY l.data_despesa DESC LIMIT $2 OFFSET $3`,
      [req.params.rubrica_projeto_id, limit, offset]
    );
    const total = lancamentos[0]?.total || 0;
    res.json({ data: lancamentos.map(({ total: _, ...l }) => l), total, page, limit });
  } catch (error) {
    console.error('List lancamentos by rubrica error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/projeto/:projeto_id', requireAuth, async (req, res) => {
  try {
    const lancamentos = await query<Lancamento>(
      `SELECT l.*, u.nome_completo as usuario_nome, rp.rubrica
       FROM lancamentos l
       LEFT JOIN usuarios u ON l.usuario_registro_id = u.id
       LEFT JOIN rubricas_projeto rp ON l.rubrica_projeto_id = rp.id
       WHERE rp.projeto_id = $1
       ORDER BY l.data_despesa DESC`,
      [req.params.projeto_id]
    );
    res.json(lancamentos);
  } catch (error) {
    console.error('List lancamentos by projeto error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
