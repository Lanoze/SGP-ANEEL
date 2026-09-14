import { Router } from 'express';
import { query, queryOne, pool, setAuditContext } from '../lib/db';
import { requireAuth, requireRole, requireMinRole } from '../lib/rbac';
import type { RubricaProjeto } from '../lib/types';

const router = Router();

router.get('/:id/rubricas', requireMinRole('PESQUISADOR'), async (req, res) => {
  try {
    const rubricas = await query<RubricaProjeto>(
      `SELECT rp.*, COALESCE(SUM(l.valor), 0) as valor_executado,
              rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
       FROM rubricas_projeto rp
       LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
       WHERE rp.projeto_id = $1
       GROUP BY rp.id, rp.valor_previsto
       ORDER BY rp.rubrica`,
      [req.params.id]
    );
    res.json(rubricas);
  } catch (error) {
    console.error('List rubricas error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/:id/rubricas', requireRole(['GESTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    const user = req.user!;
    const { rubrica_id, valor_previsto } = req.body;
    if (!rubrica_id || valor_previsto === undefined) {
      res.status(400).json({ error: 'rubrica_id e valor_previsto obrigatórios' });
      return;
    }
    if (typeof valor_previsto !== 'number' || valor_previsto < 0) {
      res.status(400).json({ error: 'valor_previsto deve ser >= 0' });
      return;
    }
    const existing = await queryOne<RubricaProjeto>('SELECT * FROM rubricas_projeto WHERE id = $1 AND projeto_id = $2', [rubrica_id, req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Rubrica não encontrada' });
      return;
    }
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    await client.query('BEGIN');
    await setAuditContext(client, user.userId, ip);
    await client.query('UPDATE rubricas_projeto SET valor_previsto = $1 WHERE id = $2', [valor_previsto, rubrica_id]);
    await client.query('COMMIT');
    res.json({ message: 'Rubrica atualizada' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Update rubrica error:', error);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

router.put('/:id/rubricas/:rubrica_id', requireRole(['GESTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    const user = req.user!;
    const { valor_previsto } = req.body;
    if (valor_previsto === undefined) {
      res.status(400).json({ error: 'valor_previsto obrigatório' });
      return;
    }
    if (typeof valor_previsto !== 'number' || valor_previsto < 0) {
      res.status(400).json({ error: 'valor_previsto deve ser >= 0' });
      return;
    }
    const existing = await queryOne<RubricaProjeto>('SELECT * FROM rubricas_projeto WHERE id = $1 AND projeto_id = $2', [req.params.rubrica_id, req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Rubrica não encontrada' });
      return;
    }
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown');
    await client.query('BEGIN');
    await setAuditContext(client, user.userId, ip);
    await client.query('UPDATE rubricas_projeto SET valor_previsto = $1 WHERE id = $2', [valor_previsto, req.params.rubrica_id]);
    await client.query('COMMIT');
    res.json({ message: 'Rubrica atualizada' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Update rubrica error:', error);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

export default router;
