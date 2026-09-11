import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/rbac';
import { z } from 'zod';

const alterarNivelSchema = z.object({
  alocacao_id: z.string().uuid(),
  nivel_complemento: z.number().int().min(0).max(3),
});

function calcularValorMensal(nominal: number, nivel: number): number {
  return nominal * (1 + nivel / 3);
}

export async function PUT(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = alterarNivelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { alocacao_id, nivel_complemento } = parsed.data;

    const alocacao = await queryOne('SELECT * FROM alocacao_rh WHERE id = $1', [alocacao_id]);
    if (!alocacao) return NextResponse.json({ error: 'Alocação não encontrada' }, { status: 404 });

    const valor_anterior = parseFloat(String(alocacao.valor_mensal_calculado));
    const novo_valor = calcularValorMensal(parseFloat(String(alocacao.valor_nominal_capes)), nivel_complemento);

    await queryOne(
      'UPDATE alocacao_rh SET nivel_complemento = $1, valor_mensal_calculado = $2 WHERE id = $3',
      [nivel_complemento, novo_valor, alocacao_id]
    );

    const { query } = await import('@/lib/db');
    await query(
      'UPDATE competencias_folha SET valor_devido = $1 WHERE alocacao_rh_id = $2 AND status = \'PENDENTE\'',
      [novo_valor, alocacao_id]
    );

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'UPDATE', tabela_origem: 'alocacao_rh', registro_id: alocacao_id, estado_anterior: { nivel_complemento: alocacao.nivel_complemento, valor_mensal_calculado: valor_anterior }, estado_posterior: { nivel_complemento, valor_mensal_calculado: novo_valor }, endereco_ip: ip });

    return NextResponse.json({ nivel_complemento, valor_mensal_calculado: novo_valor });
  } catch (error) {
    console.error('Alterar nivel error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
