import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, canAccessContratosRHForProject } from '@/lib/rbac';

export async function GET(request: Request, { params }: { params: Promise<{ projeto_id: string }> }) {
  try {
    const { projeto_id } = await params;

    const auth = requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const categoria = url.searchParams.get('categoria');

    const userCanSeeContratos = await canAccessContratosRHForProject(auth.user.perfil, projeto_id, auth.user.userId);

    let where = 'dm.projeto_id = $1';
    const sqlParams: unknown[] = [projeto_id];
    let paramIdx = 2;

    if (categoria) {
      if (categoria === 'CONTRATO_RH' && !userCanSeeContratos) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      where += ` AND dm.categoria = $${paramIdx++}`;
      sqlParams.push(categoria);
    } else if (!userCanSeeContratos) {
      where += ` AND dm.categoria != 'CONTRATO_RH'`;
    }

    const documentos = await query(
      `SELECT dm.*, u.nome_completo as usuario_nome
       FROM documentos_metadados dm LEFT JOIN usuarios u ON dm.usuario_upload_id = u.id
       WHERE ${where} ORDER BY dm.criado_em DESC`,
      sqlParams
    );
    return NextResponse.json(documentos);
  } catch (error) {
    console.error('List documentos error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
