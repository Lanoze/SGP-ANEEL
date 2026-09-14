import { Router } from 'express';
import { query, queryOne, pool } from '../lib/db';
import { requireAuth, requireRole } from '../lib/rbac';
import { createProjetoSchema, updateProjetoSchema } from '../lib/schemas';
import type { Projeto } from '../lib/types';

function gerarMeses(dataInicio: string, dataFim: string): { ano: number; mes: number }[] {
  const meses: { ano: number; mes: number }[] = [];
  const start = new Date(dataInicio);
  const end = new Date(dataFim);
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    meses.push({ ano: current.getFullYear(), mes: current.getMonth() + 1 });
    current.setMonth(current.getMonth() + 1);
  }
  return meses;
}

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const projetos = await query<Projeto>(
      `SELECT p.*, u.nome_completo as coordenador_nome
       FROM projetos p LEFT JOIN usuarios u ON p.coordenador_id = u.id
       ORDER BY p.criado_em DESC`
    );
    res.json(projetos);
  } catch (error) {
    console.error('List projetos error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/', requireRole(['GESTOR']), async (req, res) => {
  try {
    const parsed = createProjetoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim } = parsed.data;
    if (data_fim <= data_inicio) {
      res.status(400).json({ error: 'Data fim deve ser posterior à data início' });
      return;
    }
    const existing = await queryOne<{ id: string }>('SELECT id FROM projetos WHERE codigo_aneel = $1', [codigo_aneel]);
    if (existing) {
      res.status(409).json({ error: 'Código ANEEL já cadastrado' });
      return;
    }
    const result = await queryOne<{ id: string }>(
      `INSERT INTO projetos (codigo_aneel, titulo, descricao, coordenador_id, data_inicio, data_fim)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [codigo_aneel, titulo, descricao || null, coordenador_id, data_inicio, data_fim]
    );
    const rubricaCodes = ['RH', 'ST', 'MC', 'EP', 'VD', 'OU'];
    for (const code of rubricaCodes) {
      await query(
        `INSERT INTO rubricas_projeto (projeto_id, rubrica, valor_previsto) VALUES ($1, $2, 0)`,
        [result!.id, code]
      );
    }
    res.status(201).json({ id: result!.id, codigo_aneel, titulo });
  } catch (error) {
    console.error('Create projeto error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const projeto = await queryOne<Projeto>(
      `SELECT p.*, u.nome_completo as coordenador_nome
       FROM projetos p LEFT JOIN usuarios u ON p.coordenador_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!projeto) {
      res.status(404).json({ error: 'Projeto não encontrado' });
      return;
    }
    res.json(projeto);
  } catch (error) {
    console.error('Get projeto error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/:id', requireRole(['GESTOR']), async (req, res) => {
  try {
    const parsed = updateProjetoSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const fields = parsed.data;
    const existing = await queryOne<Projeto>('SELECT * FROM projetos WHERE id = $1', [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Projeto não encontrado' });
      return;
    }
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }
    if (updates.length === 0) {
      res.status(400).json({ error: 'Nenhum campo para atualizar' });
      return;
    }
    values.push(req.params.id);
    await query(`UPDATE projetos SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    if (fields.data_inicio || fields.data_fim) {
      const newInicio = fields.data_inicio || existing.data_inicio;
      const newFim = fields.data_fim || existing.data_fim;
      const novosMeses = gerarMeses(newInicio, newFim);
      const alocacoes = await query<{ id: string; valor_mensal_calculado: number }>(
        'SELECT id, valor_mensal_calculado FROM alocacao_rh WHERE projeto_id = $1', [req.params.id]
      );
      for (const aloc of alocacoes) {
        const existentes = await query<{ ano: number; mes: number; status: string }>(
          "SELECT ano, mes, status FROM competencias_folha WHERE alocacao_rh_id = $1", [aloc.id]
        );
        const existenteMap = new Map(existentes.map((e) => [`${e.ano}-${e.mes}`, e.status]));
        for (const { ano, mes } of novosMeses) {
          const key = `${ano}-${mes}`;
          if (!existenteMap.has(key)) {
            await query(
              `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
               VALUES ($1, $2, $3, $4, 'PENDENTE') ON CONFLICT (alocacao_rh_id, ano, mes) DO NOTHING`,
              [aloc.id, ano, mes, aloc.valor_mensal_calculado]
            );
          }
        }
        for (const [key, status] of existenteMap) {
          const [anoStr, mesStr] = key.split('-');
          const dentroDoRange = novosMeses.some((m) => m.ano === parseInt(anoStr) && m.mes === parseInt(mesStr));
          if (!dentroDoRange && status === 'PENDENTE') {
            await query(
              "DELETE FROM competencias_folha WHERE alocacao_rh_id = $1 AND ano = $2 AND mes = $3 AND status = 'PENDENTE'",
              [aloc.id, parseInt(anoStr), parseInt(mesStr)]
            );
          }
        }
      }
    }

    res.json({ message: 'Projeto atualizado' });
  } catch (error) {
    console.error('Update projeto error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/:id', requireRole(['GESTOR']), async (req, res) => {
  const client = await pool.connect();
  try {
    const existing = await queryOne<Projeto>('SELECT * FROM projetos WHERE id = $1', [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Projeto não encontrado' });
      return;
    }
    const projetoId = req.params.id;
    await client.query('BEGIN');

    // Delete competencias_folha via alocacao_rh
    await client.query('DELETE FROM competencias_folha WHERE alocacao_rh_id IN (SELECT id FROM alocacao_rh WHERE projeto_id = $1)', [projetoId]);
    await client.query('DELETE FROM alocacao_rh WHERE projeto_id = $1', [projetoId]);
    await client.query('DELETE FROM upload_chunks');
    await client.query('DELETE FROM documentos_payload WHERE documento_metadados_id IN (SELECT id FROM documentos_metadados WHERE projeto_id = $1)', [projetoId]);
    await client.query('DELETE FROM documentos_metadados WHERE projeto_id = $1', [projetoId]);
    await client.query('DELETE FROM lancamentos WHERE rubrica_projeto_id IN (SELECT id FROM rubricas_projeto WHERE projeto_id = $1)', [projetoId]);
    await client.query('DELETE FROM rubricas_projeto WHERE projeto_id = $1', [projetoId]);
    await client.query('DELETE FROM projetos WHERE id = $1', [projetoId]);

    await client.query('COMMIT');
    res.json({ message: 'Projeto excluído' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Delete projeto error:', error);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

export default router;
