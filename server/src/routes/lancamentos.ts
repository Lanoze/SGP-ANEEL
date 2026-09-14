import { Router } from 'express';
import { query, queryOne, pool, setAuditContext } from '../lib/db';
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

    const rubricaInfo = await queryOne<{ rubrica: string }>(
      'SELECT rubrica FROM rubricas_projeto WHERE id = $1', [rubrica_projeto_id]
    );
    if (rubricaInfo?.rubrica === 'RH') {
      res.status(400).json({ error: 'Lançamentos manuais na rubrica RH não são permitidos. Utilize a folha de pagamento.' });
      return;
    }

    const client = await pool.connect();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId, ip);
      const locked = await client.query<{ valor_previsto: number }>(
        `SELECT valor_previsto FROM rubricas_projeto WHERE id = $1 FOR UPDATE`,
        [rubrica_projeto_id]
      );
      if (locked.rows.length === 0) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Rubrica não encontrada' }); return; }
      const valorPrevisto = parseFloat(String(locked.rows[0].valor_previsto));
      const saldoResult = await client.query<{ saldo: number }>(
        `SELECT $1::numeric - COALESCE(SUM(l.valor), 0) as saldo
         FROM lancamentos l WHERE l.rubrica_projeto_id = $2`,
        [valorPrevisto, rubrica_projeto_id]
      );
      const saldo = parseFloat(String(saldoResult.rows[0].saldo));
      const valorFloat = parseFloat(String(valor));
      if (saldo < valorFloat) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Saldo insuficiente', code: 'ESTOURO_DE_RUBRICA', saldo_disponivel: saldo }); return; }
      const lancResult = await client.query<Lancamento>(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [rubrica_projeto_id, descricao, valor, data_despesa, user.userId]
      );
      const lancamento = lancResult.rows[0];
      await client.query('COMMIT');
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
    const parsed = createLancamentoSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const fields = parsed.data;
    const keys = Object.keys(fields);
    if (keys.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }
    const client = await pool.connect();
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId, ip);
      const existingResult = await client.query<Lancamento>(`SELECT * FROM lancamentos WHERE id = $1 FOR UPDATE`, [id]);
      const existing = existingResult.rows[0];
      if (!existing) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Lançamento não encontrado' }); return; }
      const novaRubrica = (fields.rubrica_projeto_id as string) || existing.rubrica_projeto_id;
      const novoValor = fields.valor !== undefined ? fields.valor : parseFloat(String(existing.valor));
      if (fields.valor !== undefined || fields.rubrica_projeto_id !== undefined) {
        const locked = await client.query<{ valor_previsto: number }>(
          `SELECT valor_previsto FROM rubricas_projeto WHERE id = $1 FOR UPDATE`,
          [novaRubrica]
        );
        if (locked.rows.length === 0) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Rubrica não encontrada' }); return; }
        const valorPrevisto = parseFloat(String(locked.rows[0].valor_previsto));
        const saldoResult = await client.query<{ saldo: number }>(
          `SELECT $1::numeric - COALESCE(SUM(l.valor), 0) + $2 as saldo
           FROM lancamentos l WHERE l.rubrica_projeto_id = $3 AND l.id != $4`,
          [valorPrevisto, (novaRubrica === existing.rubrica_projeto_id) ? parseFloat(String(existing.valor)) : 0, novaRubrica, id]
        );
        const saldoDisponivel = parseFloat(String(saldoResult.rows[0]?.saldo ?? 0));
        if (saldoDisponivel < novoValor) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Saldo insuficiente', code: 'ESTOURO_DE_RUBRICA', saldo_disponivel: saldoDisponivel }); return; }
      }
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
      const updatedResult = await client.query<Lancamento>(
        `UPDATE lancamentos SET ${setClauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id]
      );
      await client.query('COMMIT');
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
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId, ip);
      const existingResult = await client.query<Lancamento>(`SELECT * FROM lancamentos WHERE id = $1 FOR UPDATE`, [id]);
      const existing = existingResult.rows[0];
      if (!existing) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Lançamento não encontrado' }); return; }
      await client.query(`DELETE FROM lancamentos WHERE id = $1`, [id]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Delete lancamento error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
