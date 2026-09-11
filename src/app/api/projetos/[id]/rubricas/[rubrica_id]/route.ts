import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/rbac';
import { z } from 'zod';

const updateRubricaSchema = z.object({
  valor_previsto: z.number().min(0),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; rubrica_id: string }> }) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const { rubrica_id: id } = await params;
    const body = await request.json();
    const parsed = updateRubricaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const rubrica = await queryOne('SELECT * FROM rubricas_projeto WHERE id = $1', [id]);
    if (!rubrica) return NextResponse.json({ error: 'Rubrica não encontrada' }, { status: 404 });

    const updated = await queryOne(
      'UPDATE rubricas_projeto SET valor_previsto = $1 WHERE id = $2 RETURNING *',
      [parsed.data.valor_previsto, id]
    );

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'UPDATE', tabela_origem: 'rubricas_projeto', registro_id: id, estado_anterior: { valor_previsto: rubrica.valor_previsto }, estado_posterior: { valor_previsto: parsed.data.valor_previsto }, endereco_ip: ip });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update rubrica error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
