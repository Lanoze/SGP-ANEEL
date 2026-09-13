import { Router } from 'express';
import { query, pool, setAuditContext } from '../lib/db';
import { createAuditLog } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/rbac';
import { createLancamentoSchema } from '../lib/schemas';
import type { Lancamento } from '../lib/types';

const router = Router();

router.post('/', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = req.user!;
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
      const rubricaResult = await client.query<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp
         LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto
         FOR UPDATE OF rp`,
        [rubrica_projeto_id]
      );
      const rubrica = rubricaResult.rows[0];
      if (!rubrica) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Rubrica não encontrada' }); return; }
      if (rubrica.saldo < valor) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Saldo insuficiente', code: 'ESTOURO_DE_RUBRICA', saldo_disponivel: rubrica.saldo }); return; }
      const lancResult = await client.query<Lancamento>(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [rubrica_projeto_id, descricao, valor, data_despesa, user.userId]
      );
      const lancamento = lancResult.rows[0];
      await client.query('COMMIT');
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({ usuario_id: user.userId, acao: 'CREATE', tabela_origem: 'lancamentos', registro_id: lancamento.id, estado_posterior: { rubrica_projeto_id, descricao, valor, data_despesa }, endereco_ip: String(ip) });
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

router.put('/:id', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const parsed = createLancamentoSchema.partial().omit({ rubrica_projeto_id: true }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const fields = parsed.data;
    const keys = Object.keys(fields);
    if (keys.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId);
      const existingResult = await client.query<Lancamento>(`SELECT * FROM lancamentos WHERE id = $1 FOR UPDATE`, [id]);
      const existing = existingResult.rows[0];
      if (!existing) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Lancamento nao encontrado' }); return; }
      if (fields.valor !== undefined) {
        const saldoResult = await client.query<{ saldo: number }>(
          `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) + $2 as saldo
           FROM rubricas_projeto rp
           LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
           WHERE rp.id = $3 GROUP BY rp.id, rp.valor_previsto
           FOR UPDATE OF rp`,
          [existing.rubrica_projeto_id, existing.valor, existing.rubrica_projeto_id]
        );
        const saldoComReversao = saldoResult.rows[0]?.saldo ?? 0;
        if (saldoComReversao < fields.valor) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Saldo insuficiente', code: 'ESTOURO_DE_RUBRICA', saldo_disponivel: saldoComReversao }); return; }
      }
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
      const updatedResult = await client.query<Lancamento>(
        `UPDATE lancamentos SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      await client.query('COMMIT');
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({ usuario_id: user.userId, acao: 'UPDATE', tabela_origem: 'lancamentos', registro_id: id, estado_anterior: { descricao: existing.descricao, valor: existing.valor, data_despesa: existing.data_despesa }, estado_posterior: fields, endereco_ip: String(ip) });
      res.json(updatedResult.rows[0]);
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Update lancamento error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/:id', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId);
      const existingResult = await client.query<Lancamento>(`SELECT * FROM lancamentos WHERE id = $1 FOR UPDATE`, [id]);
      const existing = existingResult.rows[0];
      if (!existing) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Lancamento nao encontrado' }); return; }
      await client.query(`DELETE FROM lancamentos WHERE id = $1`, [id]);
      await client.query('COMMIT');
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({ usuario_id: user.userId, acao: 'DELETE', tabela_origem: 'lancamentos', registro_id: id, estado_anterior: { descricao: existing.descricao, valor: existing.valor, data_despesa: existing.data_despesa, rubrica_projeto_id: existing.rubrica_projeto_id }, endereco_ip: String(ip) });
      res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Delete lancamento error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
