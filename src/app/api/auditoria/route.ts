import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(request: Request) {
  try {
    const auth = requireRole(request, ['GESTOR']);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const tabela_origem = url.searchParams.get('tabela_origem');
    const registro_id = url.searchParams.get('registro_id');
    const usuario_id = url.searchParams.get('usuario_id');
    const data_inicio = url.searchParams.get('data_inicio');
    const data_fim = url.searchParams.get('data_fim');

    let where = '1=1';
    const sqlParams: unknown[] = [];
    let paramIdx = 1;

    if (tabela_origem) { where += ` AND al.tabela_origem = $${paramIdx++}`; sqlParams.push(tabela_origem); }
    if (registro_id) { where += ` AND al.registro_id = $${paramIdx++}`; sqlParams.push(registro_id); }
    if (usuario_id) { where += ` AND al.usuario_id = $${paramIdx++}`; sqlParams.push(usuario_id); }
    if (data_inicio) { where += ` AND al.criado_em >= $${paramIdx++}`; sqlParams.push(data_inicio); }
    if (data_fim) { where += ` AND al.criado_em <= $${paramIdx}::date + interval '1 day'`; sqlParams.push(data_fim); paramIdx++; }

    const logs = await query(
      `SELECT al.*, u.nome_completo as usuario_nome
       FROM audit_logs al LEFT JOIN usuarios u ON al.usuario_id = u.id
       WHERE ${where} ORDER BY al.criado_em DESC LIMIT 500`,
      sqlParams
    );
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
