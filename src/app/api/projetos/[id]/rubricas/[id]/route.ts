import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { valor_previsto } = await request.json();

    if (typeof valor_previsto !== 'number' || valor_previsto < 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
    }

    const rubrica = await queryOne('SELECT * FROM rubricas_projeto WHERE id = $1', [id]);
    if (!rubrica) return NextResponse.json({ error: 'Rubrica não encontrada' }, { status: 404 });

    const updated = await queryOne(
      'UPDATE rubricas_projeto SET valor_previsto = $1 WHERE id = $2 RETURNING *',
      [valor_previsto, id]
    );
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update rubrica error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
