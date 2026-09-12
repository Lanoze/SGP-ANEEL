import { Router } from 'express';
import { query, queryOne, pool, setAuditContext } from '../lib/db';
import { createAuditLog } from '../lib/audit';
import { requireAuth, requireRole } from '../lib/rbac';
import { createAlocacaoSchema, baixaCompetenciaSchema, baixaLoteSchema } from '../lib/schemas';
import { z } from 'zod';

const router = Router();

function calcularValorMensal(nominal: number, nivel: number): number {
  return nominal * (1 + nivel / 3);
}

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

router.get('/folha/:projeto_id', requireAuth, async (req, res) => {
  try {
    const folha = await query(
      `SELECT a.*, u.nome_completo, u.cpf,
         (SELECT json_agg(json_build_object(
           'id', cf.id, 'ano', cf.ano, 'mes', cf.mes,
           'valor_devido', cf.valor_devido, 'status', cf.status,
           'data_baixa', cf.data_baixa
         ) ORDER BY cf.ano, cf.mes)
         FROM competencias_folha cf WHERE cf.alocacao_rh_id = a.id) as competencias
       FROM alocacao_rh a LEFT JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.projeto_id = $1 ORDER BY u.nome_completo`,
      [req.params.projeto_id]
    );
    res.json(folha);
  } catch (error) {
    console.error('Get folha error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/alocacao/:projeto_id', requireAuth, async (req, res) => {
  try {
    const alocacoes = await query(
      `SELECT a.*, u.nome_completo, u.cpf, u.email
       FROM alocacao_rh a LEFT JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.projeto_id = $1 ORDER BY u.nome_completo`,
      [req.params.projeto_id]
    );
    res.json(alocacoes);
  } catch (error) {
    console.error('Get alocacoes error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/alocacao/:projeto_id', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = req.user!;
    const parsed = createAlocacaoSchema.safeParse({ ...req.body, projeto_id: req.params.projeto_id });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento } = parsed.data;

    const existing = await queryOne('SELECT id FROM alocacao_rh WHERE projeto_id = $1 AND usuario_id = $2', [projeto_id, usuario_id]);
    if (existing) { res.status(409).json({ error: 'Usuário já alocado neste projeto' }); return; }

    const valor_mensal_calculado = calcularValorMensal(valor_nominal_capes, nivel_complemento);

    const alocacao = await queryOne<{ id: string }>(
      `INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado]
    );

    const projeto = await queryOne<{ data_inicio: string; data_fim: string }>('SELECT data_inicio, data_fim FROM projetos WHERE id = $1', [projeto_id]);
    if (projeto && alocacao) {
      const meses = gerarMeses(projeto.data_inicio, projeto.data_fim);
      for (const { ano, mes } of meses) {
        await query(
          `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
           VALUES ($1, $2, $3, $4, 'PENDENTE') ON CONFLICT (alocacao_rh_id, ano, mes) DO NOTHING`,
           [alocacao.id, ano, mes, valor_mensal_calculado]
        );
      }
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (alocacao) {
      await createAuditLog({ usuario_id: user.userId, acao: 'CREATE', tabela_origem: 'alocacao_rh', registro_id: alocacao.id, estado_posterior: { projeto_id, usuario_id, papel_projeto, nivel_academico, nivel_complemento, valor_mensal_calculado }, endereco_ip: String(ip) });
    }

    res.status(201).json(alocacao);
  } catch (error) {
    console.error('Create alocacao error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/competencias/:alocacao_id', requireAuth, async (req, res) => {
  try {
    const competencias = await query(
      `SELECT cf.*, u.nome_completo as usuario_baixa_nome
       FROM competencias_folha cf LEFT JOIN usuarios u ON cf.usuario_baixa_id = u.id
       WHERE cf.alocacao_rh_id = $1 ORDER BY cf.ano, cf.mes`,
      [req.params.alocacao_id]
    );
    res.json(competencias);
  } catch (error) {
    console.error('Get competencias error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/baixar-individual', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = req.user!;
    const parsed = baixaCompetenciaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { competencia_id } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId);

      const competencia = await queryOne<{ id: string; valor_devido: number; rubrica_projeto_id: string; mes: number; ano: number; projeto_coordenador_id: string }>(
        `SELECT cf.*, rp.id as rubrica_projeto_id, p.coordenador_id as projeto_coordenador_id
         FROM competencias_folha cf
         JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
         JOIN rubricas_projeto rp ON rp.projeto_id = a.projeto_id AND rp.rubrica = 'RH'
         JOIN projetos p ON p.id = a.projeto_id
         WHERE cf.id = $1 AND cf.status = 'PENDENTE'`,
        [competencia_id]
      );

      if (!competencia) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Competência não encontrada ou já liquidada' }); return; }

      if (user.perfil === 'COORDENADOR' && competencia.projeto_coordenador_id !== user.userId) {
        await client.query('ROLLBACK');
        res.status(403).json({ error: 'Coordenador não é responsável por este projeto' });
        return;
      }

      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [competencia.rubrica_projeto_id]
      );

      if (!rubrica || rubrica.saldo < competencia.valor_devido) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Saldo RH insuficiente' }); return; }

      const saldoAnterior = rubrica.saldo;

      await client.query(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
        [competencia.rubrica_projeto_id, `Baixa folha - competência ${competencia.mes}/${competencia.ano}`, competencia.valor_devido, user.userId]
      );

      await client.query(
        `UPDATE competencias_folha SET status = 'PAGO', data_baixa = CURRENT_TIMESTAMP, usuario_baixa_id = $1 WHERE id = $2`,
        [user.userId, competencia_id]
      );

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({
        usuario_id: user.userId,
        acao: 'BAIXA_INDIVIDUAL',
        tabela_origem: 'competencias_folha',
        registro_id: competencia_id,
        estado_anterior: { status: 'PENDENTE', valor: competencia.valor_devido, saldo_rh: saldoAnterior },
        estado_posterior: { status: 'PAGO', saldo_rh: saldoAnterior - competencia.valor_devido },
        endereco_ip: String(ip),
      });

      await client.query('COMMIT');
      res.json({ message: 'Liquidação realizada com sucesso' });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Baixa individual error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/baixar-lote', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = req.user!;
    const parsed = baixaLoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { projeto_id, ano, mes } = parsed.data;

    if (user.perfil === 'COORDENADOR') {
      const projeto = await queryOne<{ coordenador_id: string }>(
        'SELECT coordenador_id FROM projetos WHERE id = $1', [projeto_id]
      );
      if (!projeto || projeto.coordenador_id !== user.userId) {
        res.status(403).json({ error: 'Coordenador não é responsável por este projeto' });
        return;
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setAuditContext(client, user.userId);

      const competencias = await query<{ id: string; valor_devido: number; rubrica_projeto_id: string }>(
        `SELECT cf.*, rp.id as rubrica_projeto_id
         FROM competencias_folha cf
         JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
         JOIN rubricas_projeto rp ON rp.projeto_id = a.projeto_id AND rp.rubrica = 'RH'
         WHERE a.projeto_id = $1 AND cf.ano = $2 AND cf.mes = $3 AND cf.status = 'PENDENTE'`,
        [projeto_id, ano, mes]
      );

      if (competencias.length === 0) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Nenhuma competência pendente' }); return; }

      const totalFolha = competencias.reduce((sum, c) => sum + parseFloat(String(c.valor_devido)), 0);
      const rubrica_projeto_id = competencias[0].rubrica_projeto_id;

      const rubrica = await queryOne<{ saldo: number }>(
        `SELECT rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM rubricas_projeto rp LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE rp.id = $1 GROUP BY rp.id, rp.valor_previsto`,
        [rubrica_projeto_id]
      );

      if (!rubrica || rubrica.saldo < totalFolha) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Saldo RH insuficiente' }); return; }

      const saldoAnterior = rubrica.saldo;

      await client.query(
        `INSERT INTO lancamentos (rubrica_projeto_id, descricao, valor, data_despesa, usuario_registro_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
        [rubrica_projeto_id, `Baixa em lote folha - ${mes}/${ano}`, totalFolha, user.userId]
      );

      for (const comp of competencias) {
        await client.query(
          `UPDATE competencias_folha SET status = 'PAGO', data_baixa = CURRENT_TIMESTAMP, usuario_baixa_id = $1 WHERE id = $2`,
          [user.userId, comp.id]
        );
      }

      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      await createAuditLog({
        usuario_id: user.userId,
        acao: 'BAIXA_LOTE',
        tabela_origem: 'competencias_folha',
        registro_id: competencias[0].id,
        estado_anterior: { competencias_pendentes: competencias.length, saldo_rh: saldoAnterior },
        estado_posterior: { competencias_liquidadas: competencias.length, total: totalFolha, saldo_rh: saldoAnterior - totalFolha },
        endereco_ip: String(ip),
      });

      await client.query('COMMIT');
      res.json({ message: 'Baixa em lote realizada', competencias_liquidadas: competencias.length, total: totalFolha });
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  } catch (error) {
    console.error('Baixa lote error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

const alterarNivelSchema = z.object({
  alocacao_id: z.string().uuid(),
  nivel_complemento: z.number().int().min(0).max(3),
});

router.put('/alterar-nivel', requireRole(['GESTOR']), async (req, res) => {
  try {
    const user = req.user!;
    const parsed = alterarNivelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { alocacao_id, nivel_complemento } = parsed.data;

    const alocacao = await queryOne('SELECT * FROM alocacao_rh WHERE id = $1', [alocacao_id]);
    if (!alocacao) { res.status(404).json({ error: 'Alocação não encontrada' }); return; }

    const valor_anterior = parseFloat(String(alocacao.valor_mensal_calculado));
    const novo_valor = calcularValorMensal(parseFloat(String(alocacao.valor_nominal_capes)), nivel_complemento);

    await queryOne(
      'UPDATE alocacao_rh SET nivel_complemento = $1, valor_mensal_calculado = $2 WHERE id = $3',
      [nivel_complemento, novo_valor, alocacao_id]
    );

    await query(
      "UPDATE competencias_folha SET valor_devido = $1 WHERE alocacao_rh_id = $2 AND status = 'PENDENTE'",
      [novo_valor, alocacao_id]
    );

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({ usuario_id: user.userId, acao: 'UPDATE', tabela_origem: 'alocacao_rh', registro_id: alocacao_id, estado_anterior: { nivel_complemento: alocacao.nivel_complemento, valor_mensal_calculado: valor_anterior }, estado_posterior: { nivel_complemento, valor_mensal_calculado: novo_valor }, endereco_ip: String(ip) });

    res.json({ nivel_complemento, valor_mensal_calculado: novo_valor });
  } catch (error) {
    console.error('Alterar nivel error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

const cancelarCompetenciaSchema = z.object({
  competencia_id: z.string().uuid(),
});

router.post('/cancelar', requireRole(['GESTOR', 'COORDENADOR']), async (req, res) => {
  try {
    const user = req.user!;
    const parsed = cancelarCompetenciaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }
    const { competencia_id } = parsed.data;

    const competencia = await queryOne<{ id: string; status: string; valor_devido: number; projeto_coordenador_id: string }>(
      `SELECT cf.*, p.coordenador_id as projeto_coordenador_id
       FROM competencias_folha cf
       JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
       JOIN projetos p ON p.id = a.projeto_id
       WHERE cf.id = $1`,
      [competencia_id]
    );

    if (!competencia) { res.status(404).json({ error: 'Competência não encontrada' }); return; }
    if (competencia.status !== 'PENDENTE') { res.status(400).json({ error: 'Só é possível cancelar competências pendentes' }); return; }

    if (user.perfil === 'COORDENADOR' && competencia.projeto_coordenador_id !== user.userId) {
      res.status(403).json({ error: 'Coordenador não é responsável por este projeto' });
      return;
    }

    await query(
      "UPDATE competencias_folha SET status = 'CANCELADO' WHERE id = $1",
      [competencia_id]
    );

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({
      usuario_id: user.userId, acao: 'CANCELAR', tabela_origem: 'competencias_folha',
      registro_id: competencia_id,
      estado_anterior: { status: 'PENDENTE', valor: competencia.valor_devido },
      estado_posterior: { status: 'CANCELADO' },
      endereco_ip: String(ip),
    });

    res.json({ message: 'Competência cancelada' });
  } catch (error) {
    console.error('Cancelar competencia error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/alocacao/:id', requireRole(['GESTOR']), async (req, res) => {
  try {
    const user = req.user!;

    const alocacao = await queryOne<{ id: string; projeto_id: string }>(
      'SELECT id, projeto_id FROM alocacao_rh WHERE id = $1', [req.params.id]
    );
    if (!alocacao) { res.status(404).json({ error: 'Alocação não encontrada' }); return; }

    const pendentes = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM competencias_folha WHERE alocacao_rh_id = $1 AND status = 'PENDENTE'",
      [req.params.id]
    );
    if (pendentes && parseInt(pendentes.count) > 0) {
      res.status(400).json({ error: 'Não é possível excluir alocação com competências pendentes. Baixe ou cancele primeiro.' });
      return;
    }

    await query('DELETE FROM alocacao_rh WHERE id = $1', [req.params.id]);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    await createAuditLog({
      usuario_id: user.userId, acao: 'DELETE', tabela_origem: 'alocacao_rh',
      registro_id: req.params.id, estado_anterior: { projeto_id: alocacao.projeto_id },
      endereco_ip: String(ip),
    });

    res.json({ message: 'Alocação excluída' });
  } catch (error) {
    console.error('Delete alocacao error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
