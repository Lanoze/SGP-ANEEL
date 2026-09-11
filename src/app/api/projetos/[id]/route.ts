import { NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { requireRole } from '@/lib/rbac';
import { createProjetoSchema } from '@/lib/schemas';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(request, ['GESTOR', 'COORDENADOR', 'PESQUISADOR', 'BOLSISTA']);
    if (auth.error) return auth.error;

    const { id } = await params;
    const projeto = await queryOne(
      `SELECT p.*, u.nome_completo as coordenador_nome
       FROM projetos p LEFT JOIN usuarios u ON p.coordenador_id = u.id
       WHERE p.id = $1`,
      [id]
    );
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    return NextResponse.json(projeto);
  } catch (error) {
    console.error('Get projeto error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const parsed = createProjetoSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const existing = await queryOne('SELECT * FROM projetos WHERE id = $1', [id]);
    if (!existing) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const data = parsed.data;

    if (data.titulo !== undefined) { updates.push(`titulo = $${idx++}`); values.push(data.titulo); }
    if (data.descricao !== undefined) { updates.push(`descricao = $${idx++}`); values.push(data.descricao); }
    if (data.coordenador_id !== undefined) { updates.push(`coordenador_id = $${idx++}`); values.push(data.coordenador_id); }
    if (data.data_inicio !== undefined) { updates.push(`data_inicio = $${idx++}`); values.push(data.data_inicio); }
    if (data.data_fim !== undefined) { updates.push(`data_fim = $${idx++}`); values.push(data.data_fim); }

    if (updates.length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });

    values.push(id);
    const updated = await queryOne(`UPDATE projetos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, values);

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'UPDATE', tabela_origem: 'projetos', registro_id: id, estado_anterior: { titulo: existing.titulo }, estado_posterior: data, endereco_ip: ip });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update projeto error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const { id } = await params;
    const existing = await queryOne('SELECT * FROM projetos WHERE id = $1', [id]);
    if (!existing) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });

    await query('DELETE FROM projetos WHERE id = $1', [id]);

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    await createAuditLog({ usuario_id: auth.user.userId, acao: 'DELETE', tabela_origem: 'projetos', registro_id: id, estado_anterior: { titulo: existing.titulo, codigo_aneel: existing.codigo_aneel }, endereco_ip: ip });

    return NextResponse.json({ message: 'Projeto removido' });
  } catch (error) {
    console.error('Delete projeto error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
