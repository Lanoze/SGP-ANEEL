import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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
