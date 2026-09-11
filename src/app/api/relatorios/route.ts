import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, requireMinRole } from '@/lib/rbac';

export async function GET(request: Request) {
  try {
    const auth = requireMinRole(request, 'COORDENADOR');
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo');

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
      return NextResponse.json(dados);
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
      return NextResponse.json(dados);
    }

    if (tipo === 'folha_instituicao') {
      const dados = await query(
        `SELECT u.nome_completo, u.perfil, u.email,
                COUNT(DISTINCT a.projeto_id) as total_projetos,
                SUM(a.valor_mensal_calculado) as valor_mensal_total,
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
      return NextResponse.json(dados);
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
      return NextResponse.json(dados);
    }

    return NextResponse.json({ error: 'Tipo de relatório inválido. Use: rubricas, folha, folha_instituicao, pendencias' }, { status: 400 });
  } catch (error) {
    console.error('Relatórios error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
