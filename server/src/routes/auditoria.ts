import { Router } from 'express';
import { query } from '../lib/db';
import { requireRole } from '../lib/rbac';

const router = Router();

router.get('/', requireRole(['GESTOR']), async (req, res) => {
  try {
    const tabela_origem = req.query.tabela_origem as string | undefined;
    const registro_id = req.query.registro_id as string | undefined;
    const usuario_id = req.query.usuario_id as string | undefined;
    const data_inicio = req.query.data_inicio as string | undefined;
    const data_fim = req.query.data_fim as string | undefined;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 50));
    const offset = (page - 1) * limit;

    let where = '1=1';
    const sqlParams: unknown[] = [];
    let paramIdx = 1;

    if (tabela_origem) { where += ` AND al.tabela_origem = $${paramIdx++}`; sqlParams.push(tabela_origem); }
    if (registro_id) { where += ` AND al.registro_id = $${paramIdx++}`; sqlParams.push(registro_id); }
    if (usuario_id) { where += ` AND al.usuario_id = $${paramIdx++}`; sqlParams.push(usuario_id); }
    if (data_inicio) { where += ` AND al.criado_em >= $${paramIdx++}`; sqlParams.push(data_inicio); }
    if (data_fim) { where += ` AND al.criado_em <= $${paramIdx}::date + interval '1 day'`; sqlParams.push(data_fim); paramIdx++; }

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM audit_logs al WHERE ${where}`,
      sqlParams
    );
    const total = parseInt(countResult[0]?.total || '0');

    const logs = await query(
      `SELECT al.*, u.nome_completo as usuario_nome
       FROM audit_logs al LEFT JOIN usuarios u ON al.usuario_id = u.id
       WHERE ${where} ORDER BY al.criado_em DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...sqlParams, limit, offset]
    );
    res.json({ data: logs, total, page, limit });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
