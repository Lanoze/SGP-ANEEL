import { Router } from 'express';
import { query } from '../lib/db';
import { requireMinRole } from '../lib/rbac';

const router = Router();

router.get('/', requireMinRole('COORDENADOR'), async (req, res) => {
  try {
    const tipo = req.query.tipo as string | undefined;

    if (tipo === 'rubricas') {
      const dados = await query(
        `SELECT p.codigo_aneel, p.titulo, rp.rubrica, rp.valor_previsto,
                COALESCE(SUM(l.valor), 0) as valor_executado,
                rp.valor_previsto - COALESCE(SUM(l.valor), 0) as saldo
         FROM projetos p
         JOIN rubricas_projeto rp ON rp.projeto_id = p.id
         LEFT JOIN lancamentos l ON l.rubrica_projeto_id = rp.id
         WHERE p.ativo = true
         GROUP BY p.id, p.codigo_aneel, p.titulo, rp.id, rp.rubrica, rp.valor_previsto
         ORDER BY p.codigo_aneel, rp.rubrica`
      );
      res.json(dados);
      return;
    }

    if (tipo === 'folha') {
      const dados = await query(
        `SELECT a.projeto_id, p.titulo as projeto_titulo, p.codigo_aneel,
                u.nome_completo, u.perfil, a.nivel_academico, a.nivel_complemento,
                a.valor_mensal_calculado,
                cf.ano, cf.mes, cf.valor_devido, cf.status
         FROM competencias_folha cf
         JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
         JOIN projetos p ON a.projeto_id = p.id
         JOIN usuarios u ON a.usuario_id = u.id
         ORDER BY p.codigo_aneel, u.nome_completo, cf.ano, cf.mes`
      );
      res.json(dados);
      return;
    }

    if (tipo === 'folha_instituicao') {
      const dados = await query(
        `SELECT u.nome_completo, u.perfil, u.email,
                COUNT(DISTINCT a.projeto_id) as total_projetos,
                (SELECT COALESCE(SUM(a2.valor_mensal_calculado), 0) FROM alocacao_rh a2
                 JOIN projetos p2 ON a2.projeto_id = p2.id AND p2.ativo = true
                 WHERE a2.usuario_id = u.id) as valor_mensal_total,
                COUNT(CASE WHEN cf.status = 'PENDENTE' THEN 1 END) as competencias_pendentes,
                COUNT(CASE WHEN cf.status = 'PAGO' THEN 1 END) as competencias_pagas,
                COALESCE(SUM(CASE WHEN cf.status = 'PENDENTE' THEN cf.valor_devido ELSE 0 END), 0) as total_pendente,
                COALESCE(SUM(CASE WHEN cf.status = 'PAGO' THEN cf.valor_devido ELSE 0 END), 0) as total_pago
         FROM usuarios u
         JOIN alocacao_rh a ON a.usuario_id = u.id
         JOIN projetos p ON a.projeto_id = p.id AND p.ativo = true
         LEFT JOIN competencias_folha cf ON cf.alocacao_rh_id = a.id
         GROUP BY u.id, u.nome_completo, u.perfil, u.email
         ORDER BY u.nome_completo`
      );
      res.json(dados);
      return;
    }

    if (tipo === 'pendencias') {
      const dados = await query(
        `SELECT p.codigo_aneel, p.titulo as projeto_titulo,
                u.nome_completo, a.nivel_academico,
                cf.ano, cf.mes, cf.valor_devido, cf.status
         FROM competencias_folha cf
         JOIN alocacao_rh a ON cf.alocacao_rh_id = a.id
         JOIN projetos p ON a.projeto_id = p.id
         JOIN usuarios u ON a.usuario_id = u.id
         WHERE cf.status = 'PENDENTE'
         ORDER BY p.codigo_aneel, cf.ano, cf.mes, u.nome_completo`
      );
      res.json(dados);
      return;
    }

    res.status(400).json({ error: 'Tipo de relatório inválido. Use: rubricas, folha, folha_instituicao, pendencias' });
  } catch (error) {
    console.error('Relatórios error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
