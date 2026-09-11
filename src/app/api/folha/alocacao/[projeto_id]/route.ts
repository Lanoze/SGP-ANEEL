import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createAlocacaoSchema } from '@/lib/schemas';

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

export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR', 'COORDENADOR']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = createAlocacaoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento } = parsed.data;

    const existing = await queryOne('SELECT id FROM alocacao_rh WHERE projeto_id = $1 AND usuario_id = $2', [projeto_id, usuario_id]);
    if (existing) return NextResponse.json({ error: 'Usuário já alocado neste projeto' }, { status: 409 });

    const valor_mensal_calculado = calcularValorMensal(valor_nominal_capes, nivel_complemento);

    const alocacao = await queryOne(
      `INSERT INTO alocacao_rh (projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [projeto_id, usuario_id, papel_projeto, nivel_academico, valor_nominal_capes, nivel_complemento, valor_mensal_calculado]
    );

    const projeto = await queryOne<{ data_inicio: string; data_fim: string }>('SELECT data_inicio, data_fim FROM projetos WHERE id = $1', [projeto_id]);
    if (projeto) {
      const meses = gerarMeses(projeto.data_inicio, projeto.data_fim);
      for (const { ano, mes } of meses) {
        await query(
          `INSERT INTO competencias_folha (alocacao_rh_id, ano, mes, valor_devido, status)
           VALUES ($1, $2, $3, $4, 'PENDENTE') ON CONFLICT (alocacao_rh_id, ano, mes) DO NOTHING`,
          [alocacao!.id, ano, mes, valor_mensal_calculado]
        );
      }
    }

    return NextResponse.json(alocacao, { status: 201 });
  } catch (error) {
    console.error('Create alocacao error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ projeto_id: string }> }) {
  try {
    const { projeto_id } = await params;
    const alocacoes = await query(
      `SELECT a.*, u.nome_completo, u.cpf, u.email
       FROM alocacao_rh a LEFT JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.projeto_id = $1 ORDER BY u.nome_completo`,
      [projeto_id]
    );
    return NextResponse.json(alocacoes);
  } catch (error) {
    console.error('Get alocacoes error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
